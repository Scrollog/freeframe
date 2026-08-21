/**
 * Review screen: the asset playing back, its comments, the marker sync, and the
 * link between the asset and the sequence that is open in Premiere.
 *
 * Wide panels put the comments beside the video; narrow ones stack them (see
 * the `.review` media query in main.scss).
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "../state";
import type { Asset, AssetVersion, Comment } from "../../lib/freeframe/types";
import { buildCommentNumbers } from "../../lib/freeframe/comment-numbers";
import { formatTimecode } from "../../lib/freeframe/timecode";
import { relativeTime, shortDate } from "../../lib/freeframe/format";
import {
  clearLink,
  clearMarkers,
  inPremiere,
  setLink,
  setPlayheadSeconds,
  syncComments,
  type AssetLink,
} from "../../lib/freeframe/host";
import { openLinkInBrowser } from "../../lib/utils/bolt";
import { Player, type PlayerHandle } from "./Player";
import { Dropdown, MenuAction, MenuCheck, MenuRadio } from "./Dropdown";
import { EmojiPicker } from "./EmojiPicker";
import { AutoTextarea } from "./AutoTextarea";
import { ConfirmDialog, type ConfirmRequest } from "./ConfirmDialog";
import { ShareDialog } from "./ShareDialog";
import {
  IconAnnotation,
  IconAttachment,
  IconCheck,
  IconCheckCircle,
  IconChevronDown,
  IconChevronLeft,
  IconChevronUp,
  IconCircle,
  IconClose,
  IconClock,
  IconCopy,
  IconDownload,
  IconEmoji,
  IconExternal,
  IconFilm,
  IconFilter,
  IconGlobe,
  IconLink,
  IconMarker,
  IconRename,
  IconPlus,
  IconReply,
  IconSearch,
  IconSend,
  IconShare,
  IconSort,
  IconTrash,
} from "./Icons";

const POLL_MS = 15000;
const MIN_REVIEW_MAIN_WIDTH = 360;
const MIN_REVIEW_SIDE_WIDTH = 240;
const REVIEW_SPLIT_CHROME_WIDTH = 18;

type SortKey = "timecode" | "oldest" | "newest" | "commenter" | "completed";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "oldest", label: "Oldest" },
  { key: "timecode", label: "Timecode (Default)" },
  { key: "newest", label: "Newest" },
  { key: "commenter", label: "Commenter" },
  { key: "completed", label: "Completed" },
];

interface Filters {
  annotations: boolean;
  attachments: boolean;
  completed: boolean;
  incomplete: boolean;
  person: string;
}

const NO_FILTERS: Filters = {
  annotations: false,
  attachments: false,
  completed: false,
  incomplete: false,
  person: "",
};

const authorOf = (comment: Comment) =>
  comment.author?.name || comment.guest_author?.name || "Guest";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

export const AssetView = ({
  asset,
  onBack,
  link,
  onLinkChange,
  onExport,
}: {
  asset: Asset;
  onBack: () => void;
  link: AssetLink | null;
  onLinkChange: (link: AssetLink | null) => void;
  onExport: () => void;
}) => {
  const { api, settings, updateSettings, user, host, refreshHost } = useApp();
  const [name, setName] = useState(asset.name);
  const [renaming, setRenaming] = useState(false);
  const [confirming, setConfirming] = useState<ConfirmRequest | null>(null);
  const [sharing, setSharing] = useState(false);
  const [versions, setVersions] = useState<AssetVersion[]>([]);
  const [versionId, setVersionId] = useState(asset.latest_version?.id ?? "");
  const [comments, setComments] = useState<Comment[]>([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState("");
  const [timecodeAttached, setTimecodeAttached] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState<{
    start: number;
    end: number;
  } | null>(null);
  const [visibility, setVisibility] = useState<"public" | "internal">("public");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [videoTime, setVideoTime] = useState(0);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("timecode");
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  // Read state is local: the API tracks notifications, not per-comment reads.
  const readIds = useMemo(
    () => new Set(settings.readComments ?? []),
    [settings.readComments]
  );
  const [justRead, setJustRead] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLUListElement>(null);
  const playerRef = useRef<PlayerHandle>(null);
  const reviewRef = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  const [sideWidth, setSideWidth] = useState(settings.sideWidth);

  /**
   * Side-by-side is driven by the panel's own width rather than a media query,
   * so the splitter and the layout switch agree on the same measurement.
   */
  useEffect(() => {
    const node = reviewRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) =>
      setWide(entry.contentRect.width >= 640)
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const onSplitterDown = (event: React.MouseEvent) => {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = sideWidth;
    const total = reviewRef.current?.clientWidth ?? 0;
    const onMove = (move: MouseEvent) => {
      // Dragging left widens the thread, so the delta is inverted.
      const next = startWidth - (move.clientX - startX);
      const maxSideWidth = Math.max(
        MIN_REVIEW_SIDE_WIDTH,
        total - MIN_REVIEW_MAIN_WIDTH - REVIEW_SPLIT_CHROME_WIDTH
      );
      setSideWidth(Math.max(MIN_REVIEW_SIDE_WIDTH, Math.min(next, maxSideWidth)));
    };
    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      setSideWidth((width) => {
        updateSettings({ sideWidth: width });
        return width;
      });
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const isLinked = link?.assetId === asset.id;
  const offset = (isLinked ? link?.offsetSeconds : 0) ?? 0;
  const isVideo = asset.asset_type === "video";
  const hasTimecode = isVideo || asset.asset_type === "audio";
  const markersOn = settings.markersVisible;
  const annotationsOn = settings.annotationsVisible;

  /** The drawing replayed over the video: the selected comment's, if any. */
  const activeAnnotation = useMemo(() => {
    if (!annotationsOn || !activeId) return null;
    const found = comments.find((comment) => comment.id === activeId);
    return found?.annotation?.drawing_data ?? null;
  }, [annotationsOn, activeId, comments]);

  /** Where a new comment lands: the player is the reference when it's there. */
  const composerTime = isVideo
    ? videoTime
    : Math.max(0, (host.playheadSeconds ?? 0) - offset);

  const timed = useMemo(
    () =>
      comments
        .filter((c) => c.timecode_start !== null && c.timecode_start !== undefined)
        .sort((a, b) => (a.timecode_start as number) - (b.timecode_start as number)),
    [comments]
  );

  const people = useMemo(() => {
    const names = new Set<string>();
    comments.forEach((comment) => names.add(authorOf(comment)));
    return [...names].sort();
  }, [comments]);

  const filtersOn =
    filters.annotations ||
    filters.attachments ||
    filters.completed ||
    filters.incomplete ||
    !!filters.person;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = comments.filter((comment) => {
      if (settings.hideResolved && comment.resolved) return false;
      if (filters.completed && !comment.resolved) return false;
      if (filters.incomplete && comment.resolved) return false;
      if (filters.annotations && !comment.annotation) return false;
      if (filters.attachments && !comment.attachments?.length) return false;
      if (filters.person && authorOf(comment) !== filters.person) return false;
      if (needle) {
        const haystack = `${comment.body} ${authorOf(comment)} ${comment.replies
          ?.map((reply) => reply.body)
          .join(" ")}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });

    const at = (comment: Comment) =>
      comment.timecode_start === null || comment.timecode_start === undefined
        ? Number.MAX_SAFE_INTEGER
        : comment.timecode_start;

    return filtered.sort((a, b) => {
      switch (sort) {
        case "timecode":
          return at(a) - at(b) || a.created_at.localeCompare(b.created_at);
        case "newest":
          return b.created_at.localeCompare(a.created_at);
        case "commenter":
          return (
            authorOf(a).localeCompare(authorOf(b)) ||
            a.created_at.localeCompare(b.created_at)
          );
        case "completed":
          return (
            Number(b.resolved) - Number(a.resolved) ||
            a.created_at.localeCompare(b.created_at)
          );
        default:
          return a.created_at.localeCompare(b.created_at);
      }
    });
  }, [comments, query, sort, filters, settings.hideResolved]);

  const openCount = comments.filter((c) => !c.resolved).length;

  /** Stable root-thread numbers, independent of visible sorting or filtering. */
  const indexOf = useMemo(() => buildCommentNumbers(comments), [comments]);

  useEffect(() => {
    setName(asset.name);
  }, [asset.id, asset.name]);

  useEffect(() => {
    (async () => {
      try {
        const list = await api.versions(asset.id);
        setVersions(list);
        setVersionId((current) => current || list[list.length - 1]?.id || "");
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, [api, asset.id]);

  const loadComments = useCallback(async () => {
    if (!versionId) return;
    try {
      setComments(await api.comments(asset.id, versionId));
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api, asset.id, versionId]);

  useEffect(() => {
    loadComments();
    // The API has no comment stream yet, so the panel polls while it is open.
    const timer = setInterval(loadComments, POLL_MS);
    return () => clearInterval(timer);
  }, [loadComments]);

  // -- navigation -------------------------------------------------------------

  /** Selecting a comment moves both playheads: the panel's and Premiere's. */
  const markRead = useCallback(
    (id: string) => {
      setJustRead((current) => new Set(current).add(id));
      if (readIds.has(id)) return;
      // Cap the log: it only exists to grey out what has already been seen.
      const next = [...(settings.readComments ?? []), id].slice(-800);
      updateSettings({ readComments: next });
    },
    [readIds, settings.readComments, updateSettings]
  );

  const jumpTo = useCallback(
    async (comment: Comment) => {
      setActiveId(comment.id);
      markRead(comment.id);
      if (comment.timecode_start === null || comment.timecode_start === undefined) return;
      const at = comment.timecode_start as number;
      playerRef.current?.seek(at);
      if (inPremiere()) await setPlayheadSeconds(at + offset);
    },
    [offset, markRead]
  );

  const step = async (direction: 1 | -1) => {
    if (!timed.length) return;
    const index = timed.findIndex((c) => c.id === activeId);
    const next =
      index === -1
        ? direction === 1
          ? 0
          : timed.length - 1
        : Math.min(timed.length - 1, Math.max(0, index + direction));
    await jumpTo(timed[next]);
    listRef.current
      ?.querySelector(`[data-comment="${timed[next].id}"]`)
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  };

  // -- markers ----------------------------------------------------------------

  const pushMarkers = useCallback(
    async (list: Comment[]) => {
      const result = await syncComments(list, {
        offsetSeconds: offset,
        fps: host.fps,
        includeResolved: !settings.hideResolved,
      });
      if (!result.ok) {
        setError(
          result.error === "no_sequence"
            ? "Open a sequence in Premiere first."
            : `Marker sync failed: ${result.error}`
        );
        return null;
      }
      await refreshHost();
      return result;
    },
    [offset, host.fps, settings.hideResolved, refreshHost]
  );

  /**
   * While markers are shown, keep them matching the thread — but only when the
   * set of comments actually changed, so the poll doesn't hit ExtendScript on
   * every tick.
   */
  const signature = comments
    .map((c) => `${c.id}:${c.resolved ? 1 : 0}:${c.timecode_start ?? ""}`)
    .join("|");

  useEffect(() => {
    if (!markersOn || !host.ok || !comments.length) return;
    pushMarkers(comments);
    // `signature` stands in for the comment set; `comments` changes every poll.
  }, [signature, markersOn, host.sequenceId]);

  const toggleMarkers = async () => {
    if (!host.ok) {
      setError("Open a sequence in Premiere first.");
      return;
    }
    setBusy(true);
    try {
      if (markersOn) {
        await clearMarkers();
        updateSettings({ markersVisible: false });
      } else {
        const result = await pushMarkers(comments);
        updateSettings({ markersVisible: true });
        // Comments outside the sequence silently have nowhere to go, so that
        // one case is still worth saying out loud.
        if (result?.skipped) {
          setError(
            `${result.skipped} comment(s) fall outside the sequence and got no marker.`
          );
        }
      }
      await refreshHost();
    } finally {
      setBusy(false);
    }
  };

  // -- asset actions ----------------------------------------------------------

  const askToLink = () => {
    if (!host.ok) {
      setError("Open a sequence in Premiere first.");
      return;
    }
    setConfirming({
      title: "Link asset to active sequence",
      body: `Linking connects "${host.sequenceName}" to ${name}, so markers and new versions from this sequence go to that asset in FreeFrame.`,
      confirmLabel: "Link asset",
      onConfirm: onLink,
    });
  };

  const onLink = async () => {
    if (!host.ok) return;
    const next: AssetLink = {
      assetId: asset.id,
      assetName: name,
      projectId: asset.project_id,
      projectName: host.projectName ?? "",
      versionId,
      offsetSeconds: offset,
    };
    const result = await setLink(next);
    if (!result.ok) {
      // XMP can be unavailable (no project item, read-only project); the local
      // copy still keeps the panel useful for this session.
      setError("Linked locally — Premiere would not store it in the project.");
    }
    onLinkChange(next);

    const markerResult = await pushMarkers(comments);
    if (markerResult) {
      updateSettings({ markersVisible: true });
      if (markerResult.skipped) {
        setError(
          `${markerResult.skipped} comment(s) fall outside the sequence and got no marker.`
        );
      }
    }
  };

  const askToUnlink = () => {
    setConfirming({
      title: "Unlink asset from active sequence",
      body: `Unlinking disconnects "${name}" from ${host.sequenceName ?? "this sequence"} and removes its FreeFrame markers from the timeline.`,
      confirmLabel: "Unlink asset",
      danger: true,
      onConfirm: onUnlink,
    });
  };

  const onUnlink = async () => {
    try {
      // Only FreeFrame-owned markers are removed; hand-made Premiere markers
      // are left untouched by the host-side clearMarkers implementation.
      await clearMarkers();
    } finally {
      updateSettings({ markersVisible: false });
      await clearLink();
      onLinkChange(null);
    }
  };

  const assetUrl = (commentId?: string) => {
    const base = (settings.webUrl || settings.serverUrl).replace(/\/+$/, "");
    const suffix = commentId ? `?commentId=${commentId}` : "";
    return `${base}/projects/${asset.project_id}/assets/${asset.id}${suffix}`;
  };

  const onDownload = async () => {
    try {
      openLinkInBrowser(await api.downloadUrl(asset.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onRename = async () => {
    const trimmed = name.trim();
    setRenaming(false);
    if (!trimmed || trimmed === asset.name) {
      setName(asset.name);
      return;
    }
    try {
      await api.renameAsset(asset.id, trimmed);
      asset.name = trimmed;
    } catch (e) {
      setName(asset.name);
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onDelete = async () => {
    try {
      await api.deleteAsset(asset.id);
      if (isLinked) await onUnlink();
      onBack();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  // -- comment actions --------------------------------------------------------

  const onPost = async () => {
    if (!draft.trim() || !versionId) return;
    setBusy(true);
    try {
      await api.createComment(asset.id, {
        version_id: versionId,
        body: draft.trim(),
        timecode_start: timecodeAttached
          ? selectedTimeRange?.start ?? composerTime
          : null,
        timecode_end:
          timecodeAttached &&
          selectedTimeRange &&
          selectedTimeRange.end - selectedTimeRange.start > 0.05
            ? selectedTimeRange.end
            : undefined,
        visibility,
      });
      setDraft("");
      setSelectedTimeRange(null);
      await loadComments();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const onReply = async (commentId: string) => {
    if (!replyDraft.trim() || !versionId) return;
    try {
      await api.reply(asset.id, commentId, versionId, replyDraft.trim());
      setReplyDraft("");
      setReplyTo(null);
      await loadComments();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  /** Toggling a reaction is optimistic too; the poll reconciles the counts. */
  const onReact = async (comment: Comment, emoji: string) => {
    setComments((current) =>
      current.map((c) => {
        if (c.id !== comment.id) return c;
        const reactions = [...(c.reactions ?? [])];
        const index = reactions.findIndex((r) => r.emoji === emoji);
        if (index === -1) {
          reactions.push({ emoji, count: 1, reacted: true });
        } else {
          const hit = reactions[index];
          const count = hit.count + (hit.reacted ? -1 : 1);
          if (count <= 0) reactions.splice(index, 1);
          else reactions[index] = { ...hit, count, reacted: !hit.reacted };
        }
        return { ...c, reactions };
      })
    );
    try {
      await api.react(comment.id, emoji);
      await loadComments();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      await loadComments();
    }
  };

  /** Optimistic so the checkbox feels instant; the poll reconciles it. */
  const onToggleDone = async (comment: Comment) => {
    setComments((current) =>
      current.map((c) => (c.id === comment.id ? { ...c, resolved: !c.resolved } : c))
    );
    try {
      await api.resolve(comment.id);
      await loadComments();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      await loadComments();
    }
  };

  const onDeleteComment = async (comment: Comment) => {
    try {
      await api.deleteComment(comment.id);
      if (activeId === comment.id) setActiveId(null);
      await loadComments();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="asset-view">
      <ConfirmDialog request={confirming} onClose={() => setConfirming(null)} />
      {sharing && (
        <ShareDialog
          asset={asset}
          onClose={() => setSharing(false)}
          onRenamed={(next) => setName(next)}
        />
      )}

      <nav className="navbar">
        <button className="icon-btn" onClick={onBack} title="Back">
          <IconChevronLeft width={15} height={15} />
        </button>
        {renaming ? (
          <input
            className="rename"
            value={name}
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onBlur={onRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") onRename();
              if (e.key === "Escape") {
                setName(asset.name);
                setRenaming(false);
              }
            }}
          />
        ) : (
          <Dropdown
            triggerClass="name-btn"
            align="left"
            trigger={
              <>
                <span className="name-text">{name}</span>
                <IconChevronDown width={12} height={12} />
              </>
            }
          >
            {(close) => (
              <>
                <MenuAction
                  icon={<IconLink width={14} height={14} />}
                  label={isLinked ? "Unlink from sequence" : "Link to Premiere Sequence"}
                  sub={host.ok ? host.sequenceName : "no sequence open"}
                  onSelect={() => {
                    close();
                    if (isLinked) askToUnlink();
                    else askToLink();
                  }}
                />
                <div className="menu-rule" />
                <MenuAction
                  icon={<IconDownload width={14} height={14} />}
                  label="Download"
                  onSelect={() => {
                    close();
                    onDownload();
                  }}
                />
                <MenuAction
                  icon={<IconCopy width={14} height={14} />}
                  label="Copy Asset URL"
                  onSelect={() => {
                    close();
                    navigator.clipboard?.writeText(assetUrl());
                  }}
                />
                <MenuAction
                  icon={<IconExternal width={14} height={14} />}
                  label="Open in browser"
                  onSelect={() => {
                    close();
                    openLinkInBrowser(assetUrl());
                  }}
                />
                <div className="menu-rule" />
                <MenuAction
                  icon={<IconRename width={14} height={14} />}
                  label="Rename"
                  onSelect={() => {
                    close();
                    setRenaming(true);
                  }}
                />
                <MenuAction
                  danger
                  icon={<IconTrash width={14} height={14} />}
                  label="Delete"
                  onSelect={() => {
                    close();
                    setConfirming({
                      title: "Delete asset",
                      body: `"${name}" moves to the project trash. You can restore it from the FreeFrame web app.`,
                      confirmLabel: "Delete",
                      danger: true,
                      onConfirm: onDelete,
                    });
                  }}
                />
              </>
            )}
          </Dropdown>
        )}
        <Dropdown
          align="left"
          triggerClass="version-trigger"
          title="Versions"
          trigger={
            <>
              v{versions.find((v) => v.id === versionId)?.version_number ?? 1}
              <IconChevronDown width={12} height={12} />
            </>
          }
        >
          {(close) => (
            <div className="version-list">
              {[...versions].reverse().map((version) => {
                const isLatest = version.id === asset.latest_version?.id;
                return (
                  <button
                    key={version.id}
                    className={`version-row${version.id === versionId ? " on" : ""}`}
                    onClick={() => {
                      setVersionId(version.id);
                      close();
                    }}
                  >
                    <em className="badge version">v{version.version_number}</em>
                    <span className="version-thumb">
                      {/* Only the newest version has a thumbnail URL in the
                          API; older ones fall back to the film glyph. */}
                      {isLatest && asset.thumbnail_url ? (
                        <img src={asset.thumbnail_url} alt="" />
                      ) : (
                        <IconFilm width={14} height={14} />
                      )}
                    </span>
                    <span className="version-meta">
                      <strong>{name}</strong>
                      <span>{shortDate(version.created_at)}</span>
                    </span>
                    {version.id === versionId && (
                      <IconCheck width={13} height={13} className="version-check" />
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </Dropdown>

        <span className="spacer" />

        <button className="chip with-icon" onClick={() => setSharing(true)}>
          <IconShare width={13} height={13} />
          Share
        </button>
        <button
          className="primary icon-btn"
          onClick={onExport}
          title="Export this sequence"
        >
          <IconPlus width={15} height={15} />
        </button>
      </nav>

      <div className={`review${wide ? " wide" : ""}`} ref={reviewRef}>
        <div className="review-main">
          {isVideo && versionId && (
            <Player
              ref={playerRef}
              api={api}
              assetId={asset.id}
              versionId={versionId}
              comments={comments}
              fps={host.fps}
              annotation={activeAnnotation}
              selectedTimeRange={selectedTimeRange}
              onSelectedTimeRangeChange={setSelectedTimeRange}
              onTimeUpdate={setVideoTime}
              onSelectComment={jumpTo}
            />
          )}

        </div>

        {wide && (
          <div className="splitter" onMouseDown={onSplitterDown} title="Drag to resize" />
        )}

        <div
          className="review-side"
          style={wide ? { flex: `0 0 ${sideWidth}px` } : undefined}
        >
          <div className="side-head">
            {searching ? (
              <>
                <div className="field">
                  <IconSearch />
                  <input
                    type="search"
                    placeholder="Search comments…"
                    value={query}
                    autoFocus
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
                <button
                  className="text-btn"
                  onClick={() => {
                    setSearching(false);
                    setQuery("");
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span className="side-title">
                  All comments <em>{openCount}</em>
                </span>
                <button
                  className={`icon-btn${markersOn ? " accented" : ""}`}
                  onClick={toggleMarkers}
                  disabled={busy || !host.ok}
                  title={
                    markersOn
                      ? "Hide FreeFrame markers on the timeline"
                      : "Show comments as markers on the timeline"
                  }
                >
                  <IconMarker />
                </button>
                <button
                  className={`icon-btn${annotationsOn ? " accented" : ""}`}
                  onClick={() =>
                    updateSettings({ annotationsVisible: !annotationsOn })
                  }
                  title={
                    annotationsOn
                      ? "Hide annotations over the video"
                      : "Show annotations over the video"
                  }
                >
                  <IconAnnotation />
                </button>
                <Dropdown trigger={<IconFilter />} title="Filter by…" active={filtersOn}>
                  {() => (
                    <>
                      <MenuCheck
                        label="Annotations"
                        icon={<IconAnnotation width={13} height={13} />}
                        checked={filters.annotations}
                        onChange={(value) =>
                          setFilters({ ...filters, annotations: value })
                        }
                      />
                      <MenuCheck
                        label="Attachments"
                        icon={<IconAttachment width={13} height={13} />}
                        checked={filters.attachments}
                        onChange={(value) =>
                          setFilters({ ...filters, attachments: value })
                        }
                      />
                      <MenuCheck
                        label="Completed"
                        icon={<IconCheckCircle width={13} height={13} />}
                        checked={filters.completed}
                        onChange={(value) =>
                          setFilters({ ...filters, completed: value, incomplete: false })
                        }
                      />
                      <MenuCheck
                        label="Incomplete"
                        icon={<IconCircle width={13} height={13} />}
                        checked={filters.incomplete}
                        onChange={(value) =>
                          setFilters({ ...filters, incomplete: value, completed: false })
                        }
                      />
                      {people.length > 1 && (
                        <>
                          <div className="menu-sep">Person</div>
                          {people.map((person) => (
                            <MenuRadio
                              key={person}
                              label={person}
                              checked={filters.person === person}
                              onSelect={() =>
                                setFilters({
                                  ...filters,
                                  person: filters.person === person ? "" : person,
                                })
                              }
                            />
                          ))}
                        </>
                      )}
                      <button className="menu-foot" onClick={() => setFilters(NO_FILTERS)}>
                        Clear Filters
                      </button>
                    </>
                  )}
                </Dropdown>
                <Dropdown trigger={<IconSort />} title="Sort thread by…">
                  {(close) =>
                    SORTS.map((option) => (
                      <MenuRadio
                        key={option.key}
                        label={option.label}
                        checked={sort === option.key}
                        onSelect={() => {
                          setSort(option.key);
                          close();
                        }}
                      />
                    ))
                  }
                </Dropdown>
                <button
                  className="icon-btn"
                  onClick={() => setSearching(true)}
                  title="Search comments"
                >
                  <IconSearch />
                </button>
                <span className="stepper">
                  <button
                    className="icon-btn"
                    onClick={() => step(-1)}
                    disabled={!timed.length}
                    title="Previous comment"
                  >
                    <IconChevronUp width={14} height={14} />
                  </button>
                  <button
                    className="icon-btn"
                    onClick={() => step(1)}
                    disabled={!timed.length}
                    title="Next comment"
                  >
                    <IconChevronDown width={14} height={14} />
                  </button>
                </span>
              </>
            )}
          </div>

          {error && <p className="error">{error}</p>}

          <ul className="comments" ref={listRef}>
            {visible.map((comment) => (
              <li
                key={comment.id}
                data-comment={comment.id}
                className={`comment${comment.id === activeId ? " active" : ""}${
                  comment.resolved ? " resolved" : ""
                }${comment.replies?.length ? " has-replies" : ""}`}
                onClick={() => jumpTo(comment)}
              >
                {user &&
                  comment.author?.id !== user.id &&
                  !readIds.has(comment.id) && <span className="unread-dot" />}
                <div className="comment-head">
                  <span className="avatar">
                    {comment.author?.avatar_url ? (
                      <img src={comment.author.avatar_url} alt="" />
                    ) : (
                      initialsOf(authorOf(comment))
                    )}
                  </span>
                  <span className="author">{authorOf(comment)}</span>
                  {comment.annotation && (
                    <span className="has-annotation" title="Has an annotation">
                      <IconAnnotation width={12} height={12} />
                    </span>
                  )}
                  <span className="when">
                    {justRead.has(comment.id)
                      ? "Read by you"
                      : relativeTime(comment.created_at)}
                  </span>
                  <span className="index">#{indexOf.get(comment.id)}</span>
                  <button
                    className={`done-box${comment.resolved ? " on" : ""}`}
                    title={comment.resolved ? "Mark as not done" : "Mark as done"}
                    onClick={(event) => {
                      event.stopPropagation();
                      onToggleDone(comment);
                    }}
                  >
                    <IconCheck width={11} height={11} />
                  </button>
                </div>
                <p className="body">
                  {comment.timecode_start !== null && (
                    <span className="tc">
                      {formatTimecode(comment.timecode_start, host.fps)}
                      {comment.timecode_end !== null &&
                        comment.timecode_end !== undefined &&
                        comment.timecode_end - comment.timecode_start > 0.05 && (
                          <> – {formatTimecode(comment.timecode_end, host.fps)}</>
                        )}
                    </span>
                  )}
                  {comment.body}
                </p>
                {!!comment.replies?.length && (
                  <div className="replies">
                    {comment.replies.map((reply) => (
                      <div key={reply.id} className="reply">
                        <span className="avatar">
                          {reply.author?.avatar_url ? (
                            <img src={reply.author.avatar_url} alt="" />
                          ) : (
                            initialsOf(authorOf(reply))
                          )}
                        </span>
                        <p>
                          <strong>{authorOf(reply)}</strong> {reply.body}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
                {!!comment.reactions?.length && (
                  <div className="reactions" onClick={(e) => e.stopPropagation()}>
                    {comment.reactions.map((reaction) => (
                      <button
                        key={reaction.emoji}
                        className={`reaction${reaction.reacted ? " on" : ""}`}
                        title={reaction.reacted ? "Remove your reaction" : "React"}
                        onClick={() => onReact(comment, reaction.emoji)}
                      >
                        <span>{reaction.emoji}</span>
                        {reaction.count}
                      </button>
                    ))}
                  </div>
                )}
                <div className="comment-actions" onClick={(e) => e.stopPropagation()}>
                  <EmojiPicker
                    title="React"
                    trigger={<IconEmoji width={13} height={13} />}
                    onPick={(emoji) => onReact(comment, emoji)}
                  />
                  <button
                    className="text-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      setReplyTo(replyTo === comment.id ? null : comment.id);
                    }}
                  >
                    <IconReply width={12} height={12} />
                    Reply
                  </button>
                  <button
                    className="text-btn"
                    onClick={(event) => {
                      event.stopPropagation();
                      openLinkInBrowser(assetUrl(comment.id));
                    }}
                  >
                    <IconExternal width={12} height={12} />
                    Open
                  </button>
                  {user &&
                    (user.is_superadmin || comment.author?.id === user.id) && (
                      <button
                        className="text-btn danger"
                        onClick={(event) => {
                          event.stopPropagation();
                          setConfirming({
                            title: "Delete comment",
                            body: "This comment will be removed from the review.",
                            confirmLabel: "Delete",
                            danger: true,
                            onConfirm: () => onDeleteComment(comment),
                          });
                        }}
                      >
                        <IconTrash width={12} height={12} />
                        Delete
                      </button>
                    )}
                </div>
                {replyTo === comment.id && (
                  <div className="reply-box" onClick={(event) => event.stopPropagation()}>
                    <AutoTextarea
                      value={replyDraft}
                      onChange={(e) => setReplyDraft(e.target.value)}
                      placeholder="Reply…"
                      autoFocus
                    />
                    <EmojiPicker onPick={(emoji) => setReplyDraft((text) => text + emoji)} />
                    <button className="primary" onClick={() => onReply(comment.id)}>
                      <IconSend width={14} height={14} />
                    </button>
                  </div>
                )}
              </li>
            ))}
            {!visible.length && (
              <li className="muted empty">
                {comments.length ? "No comments match." : "No comments on this version."}
              </li>
            )}
          </ul>

          <div className="composer">
            <div className="composer-input">
              {timecodeAttached && (
                <span className="tc composer-tc">
                  {selectedTimeRange ? (
                    selectedTimeRange.end - selectedTimeRange.start > 0.05 ? (
                      <>
                        {formatTimecode(selectedTimeRange.start, host.fps)} –{" "}
                        {formatTimecode(selectedTimeRange.end, host.fps)}
                      </>
                    ) : (
                      formatTimecode(selectedTimeRange.start, host.fps)
                    )
                  ) : (
                    formatTimecode(composerTime, host.fps)
                  )}
                  {selectedTimeRange && (
                    <button
                      className="range-clear"
                      onClick={() => setSelectedTimeRange(null)}
                      title="Clear selected range"
                    >
                      <IconClose width={10} height={10} />
                    </button>
                  )}
                </span>
              )}
              <AutoTextarea
                value={draft}
                onChange={(e) => {
                  const value = e.target.value;
                  setDraft(value);
                  if (
                    value.trim() &&
                    hasTimecode &&
                    timecodeAttached &&
                    !selectedTimeRange
                  ) {
                    setSelectedTimeRange({ start: composerTime, end: composerTime });
                  }
                }}
                placeholder="Leave your comment…"
              />
            </div>
            <div className="composer-actions">
              <EmojiPicker onPick={(emoji) => setDraft((text) => text + emoji)} />
              {hasTimecode && (
                <button
                  className={`icon-btn timecode-toggle${timecodeAttached ? " on" : ""}`}
                  onClick={() => {
                    if (timecodeAttached) setSelectedTimeRange(null);
                    setTimecodeAttached((attached) => !attached);
                  }}
                  title={timecodeAttached ? "Detach timecode" : "Attach timecode"}
                >
                  <IconClock width={14} height={14} />
                </button>
              )}
              <span className="spacer" />
              <Dropdown
                up
                align="right"
                triggerClass="chip with-icon"
                trigger={
                  <>
                    <IconGlobe width={13} height={13} />
                    {visibility === "internal" ? "Internal" : "Public"}
                    <IconChevronDown width={12} height={12} />
                  </>
                }
              >
                {(close) => (
                  <>
                    <MenuRadio
                      label="Public — everyone on the asset"
                      checked={visibility === "public"}
                      onSelect={() => {
                        setVisibility("public");
                        close();
                      }}
                    />
                    <MenuRadio
                      label="Internal — team only"
                      checked={visibility === "internal"}
                      onSelect={() => {
                        setVisibility("internal");
                        close();
                      }}
                    />
                  </>
                )}
              </Dropdown>
              <button
                className="primary"
                onClick={onPost}
                disabled={busy || !draft.trim()}
                title="Post"
              >
                <IconSend width={14} height={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
