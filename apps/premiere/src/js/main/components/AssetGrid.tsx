/** Second browse screen: folders and assets of one project, as cards. */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useApp } from "../state";
import type { Asset, FolderNode, Project } from "../../lib/freeframe/types";
import { formatDuration, shortDate } from "../../lib/freeframe/format";
import { Dropdown, MenuAction } from "./Dropdown";
import { AppearanceMenu, SortedByMenu, cardMinWidth } from "./BrowseControls";
import { openLinkInBrowser } from "../../lib/utils/bolt";
import { useProjectEvents } from "../../lib/freeframe/events";
import type { AssetLink } from "../../lib/freeframe/host";
import { ConfirmDialog, type ConfirmRequest } from "./ConfirmDialog";
import { ShareDialog } from "./ShareDialog";
import { ScrubThumb } from "./ScrubThumb";
import {
  IconCloudUpload,
  IconClose,
  IconComment,
  IconCopy,
  IconDownload,
  IconShare,
  IconRename,
  IconExternal,
  IconFilm,
  IconMarker,
  IconMore,
  IconTrash,
  IconFolder,
  IconHome,
  IconPlus,
  IconRefresh,
  IconSearch,
} from "./Icons";

/** Comment counts aren't on the asset list, so fetch a bounded few by hand. */
const COUNT_LIMIT = 24;
const COUNT_CONCURRENCY = 4;

type SortKey = "name" | "newest" | "oldest" | "duration";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "newest", label: "Date" },
  { key: "oldest", label: "Oldest" },
  { key: "duration", label: "Duration" },
];

interface Crumb {
  id: string | null;
  name: string;
}

const findNode = (nodes: FolderNode[], id: string): FolderNode | null => {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = node.children ? findNode(node.children, id) : null;
    if (hit) return hit;
  }
  return null;
};

const durationOf = (asset: Asset) =>
  asset.latest_version?.files?.[0]?.duration_seconds ?? 0;

export const AssetGrid = ({
  project,
  onBack,
  onOpenAsset,
  onExport,
  link,
}: {
  project: Project;
  onBack: () => void;
  onOpenAsset: (asset: Asset) => void;
  onExport: () => void;
  /** The asset bound to the sequence open in Premiere, if it is in this grid. */
  link: AssetLink | null;
}) => {
  const { api, settings, host } = useApp();
  const [tree, setTree] = useState<FolderNode[]>([]);
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ id: null, name: "Assets" }]);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [sort, setSort] = useState<SortKey>("name");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [confirming, setConfirming] = useState<ConfirmRequest | null>(null);
  const [sharing, setSharing] = useState<Asset | null>(null);
  const [renamingId, setRenamingId] = useState("");
  const [draftName, setDraftName] = useState("");

  const folderId = crumbs[crumbs.length - 1].id;

  const load = useCallback(async (refresh = false) => {
    setLoading(true);
    setError("");
    try {
      const [folders, items] = await Promise.all([
        api.folderTree(project.id, refresh),
        api.assets(project.id, folderId ?? "root", refresh),
      ]);
      setTree(folders);
      setAssets(items);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [api, project.id, folderId]);

  useEffect(() => {
    load();
  }, [load]);

  // The thumbnail only exists once transcoding ends, which is well after the
  // upload returns — so listen for it instead of guessing at a delay.
  useProjectEvents(api, project.id, () => load(true));

  /**
   * Refresh when an export lands in this project. The second pass catches the
   * thumbnail, which only exists once the server finishes transcoding.
   */
  const latestExport = settings.exportHistory?.[0];
  useEffect(() => {
    if (!latestExport || latestExport.projectId !== project.id) return;
    load(true);
    const timer = setTimeout(() => load(true), 8000);
    return () => clearTimeout(timer);
  }, [latestExport?.uploadedAt, latestExport?.projectId, project.id, load]);

  /**
   * Comment counts for the badge. The API has no aggregate endpoint, so this
   * walks the newest versions a few at a time and gives up past COUNT_LIMIT
   * rather than firing a request per asset in a large folder.
   */
  useEffect(() => {
    let cancelled = false;
    const targets = assets
      .filter((asset) => asset.latest_version?.id)
      .slice(0, COUNT_LIMIT);
    if (!targets.length) return;

    (async () => {
      let cursor = 0;
      const worker = async () => {
        while (!cancelled && cursor < targets.length) {
          const asset = targets[cursor++];
          try {
            const list = await api.comments(asset.id, asset.latest_version!.id);
            if (cancelled) return;
            // Replies count too — the badge mirrors the thread total.
            const total = list.reduce(
              (sum, comment) => sum + 1 + (comment.replies?.length ?? 0),
              0
            );
            setCounts((current) => ({ ...current, [asset.id]: total }));
          } catch (e) {
            // A count is decoration; a failure just leaves the badge off.
          }
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(COUNT_CONCURRENCY, targets.length) }, worker)
      );
    })();

    return () => {
      cancelled = true;
    };
  }, [api, assets]);

  const childFolders = useMemo(() => {
    if (!folderId) return tree;
    return findNode(tree, folderId)?.children ?? [];
  }, [tree, folderId]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? assets.filter((asset) => asset.name.toLowerCase().includes(needle))
      : assets.slice();
    return filtered.sort((a, b) => {
      switch (sort) {
        case "newest":
          return b.created_at.localeCompare(a.created_at);
        case "oldest":
          return a.created_at.localeCompare(b.created_at);
        case "duration":
          return durationOf(b) - durationOf(a);
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [assets, query, sort]);

  const assetUrl = (asset: Asset) =>
    `${(settings.webUrl || settings.serverUrl).replace(/\/+$/, "")}/projects/${
      asset.project_id
    }/assets/${asset.id}`;

  const onDownload = async (asset: Asset) => {
    try {
      openLinkInBrowser(await api.downloadUrl(asset.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onRename = async (asset: Asset) => {
    const trimmed = draftName.trim();
    setRenamingId("");
    if (!trimmed || trimmed === asset.name) return;
    try {
      await api.renameAsset(asset.id, trimmed);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const onDelete = async (asset: Asset) => {
    try {
      await api.deleteAsset(asset.id);
      await load(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="browse">
      <ConfirmDialog request={confirming} onClose={() => setConfirming(null)} />
      {sharing && (
        <ShareDialog
          asset={sharing}
          onClose={() => setSharing(null)}
          onRenamed={() => load(true)}
        />
      )}

      <nav className="navbar">
        <button className="icon-btn" onClick={onBack} title="All projects">
          <IconHome width={15} height={15} />
        </button>
        <div className="crumbs">
          {crumbs.map((crumb, index) => (
            <span key={crumb.id ?? "root"} className="crumb-slot">
              <span className="sep">/</span>
              <button
                className="crumb"
                disabled={index === crumbs.length - 1}
                onClick={() => setCrumbs(crumbs.slice(0, index + 1))}
              >
                {index === 0 ? project.name : crumb.name}
              </button>
            </span>
          ))}
        </div>
      </nav>

      <div className="view-bar">
        {searching ? (
          <>
            <div className="field">
              <IconSearch />
              <input
                type="search"
                placeholder={`Search in ${project.name}`}
                value={query}
                autoFocus
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setQuery("");
                    setSearching(false);
                  }
                }}
              />
            </div>
            <button
              className="icon-btn"
              title="Close search"
              onClick={() => {
                setQuery("");
                setSearching(false);
              }}
            >
              <IconClose width={15} height={15} />
            </button>
          </>
        ) : (
          <>
            <AppearanceMenu />
            <span className="bar-sep" />
            <SortedByMenu options={SORTS} value={sort} onChange={setSort} />
            <span className="spacer" />
            <button
              className="icon-btn"
              onClick={() => setSearching(true)}
              title="Search"
            >
              <IconSearch />
            </button>
            <button className="icon-btn" onClick={() => load(true)} title="Refresh">
              <IconRefresh />
            </button>
            <button
              className="primary icon-btn"
              onClick={onExport}
              title="Export the active sequence here"
            >
              <IconPlus width={15} height={15} />
            </button>
          </>
        )}
      </div>

      {error && <p className="error">{error}</p>}
      {loading && <p className="muted">Loading…</p>}

      {childFolders.length > 0 && (
        <div className="folder-row">
          {childFolders.map((folder) => (
            <button
              key={folder.id}
              className="folder-chip"
              onClick={() => setCrumbs([...crumbs, { id: folder.id, name: folder.name }])}
            >
              <IconFolder width={14} height={14} />
              <span>{folder.name}</span>
              {!!folder.item_count && <em>{folder.item_count}</em>}
            </button>
          ))}
        </div>
      )}

      <div
        className="card-grid assets"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${cardMinWidth(
            settings.cardSize
          )}px), 1fr))`,
        }}
      >
        {visible.map((asset) => {
          const duration = durationOf(asset);
          const version = asset.latest_version?.version_number ?? 1;
          return (
            <div
              key={asset.id}
              className="card"
              role="button"
              tabIndex={0}
              onClick={() => onOpenAsset(asset)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") onOpenAsset(asset);
              }}
            >
              <span className="poster asset-poster">
                <ScrubThumb
                  api={api}
                  assetId={asset.id}
                  versionId={asset.latest_version?.id}
                  thumbnailUrl={asset.thumbnail_url}
                >
                  {!asset.thumbnail_url && (
                    <span className="poster-fallback">
                      <IconFilm width={22} height={22} />
                    </span>
                  )}
                  {!!counts[asset.id] && (
                    <em className="badge count">
                      <IconComment width={11} height={11} />
                      {counts[asset.id]}
                    </em>
                  )}
                  {duration > 0 && (
                    <em className="badge time">{formatDuration(duration)}</em>
                  )}
                  <span className="badge-row">
                    {version > 1 && <em className="badge version">v{version}</em>}
                    {link?.assetId === asset.id && (
                      <em
                        className="badge linked"
                        title="Linked to the sequence open in Premiere"
                      >
                        <IconMarker width={12} height={12} />
                      </em>
                    )}
                  </span>
                </ScrubThumb>
              </span>
              <span className="card-foot">
                {renamingId === asset.id ? (
                  <input
                    className="card-rename"
                    value={draftName}
                    autoFocus
                    onClick={(event) => event.stopPropagation()}
                    onChange={(event) => setDraftName(event.target.value)}
                    onBlur={() => onRename(asset)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") onRename(asset);
                      if (event.key === "Escape") setRenamingId("");
                    }}
                  />
                ) : (
                  <span className="card-title">{asset.name}</span>
                )}
                <span className="card-sub">
                  v{version} ·{" "}
                  {shortDate(asset.updated_at || asset.created_at)}
                </span>
              </span>
              <span className="card-menu-slot">
                <Dropdown
                  up
                  triggerClass="card-menu"
                  trigger={<IconMore width={15} height={15} />}
                >
                  {(close) => (
                    <>
                      <MenuAction
                        icon={<IconShare width={14} height={14} />}
                        label="Create Share Link"
                        onSelect={() => {
                          close();
                          setSharing(asset);
                        }}
                      />
                      <div className="menu-rule" />
                      <MenuAction
                        icon={<IconDownload width={14} height={14} />}
                        label="Download"
                        onSelect={() => {
                          close();
                          onDownload(asset);
                        }}
                      />
                      <MenuAction
                        icon={<IconCopy width={14} height={14} />}
                        label="Copy Asset URL"
                        onSelect={() => {
                          close();
                          navigator.clipboard?.writeText(assetUrl(asset));
                        }}
                      />
                      <MenuAction
                        icon={<IconExternal width={14} height={14} />}
                        label="Open in browser"
                        onSelect={() => {
                          close();
                          openLinkInBrowser(assetUrl(asset));
                        }}
                      />
                      <div className="menu-rule" />
                      <MenuAction
                        icon={<IconRename width={14} height={14} />}
                        label="Rename"
                        onSelect={() => {
                          close();
                          setDraftName(asset.name);
                          setRenamingId(asset.id);
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
                            body: `"${asset.name}" moves to the project trash. You can restore it from the FreeFrame web app.`,
                            confirmLabel: "Delete",
                            danger: true,
                            onConfirm: () => onDelete(asset),
                          });
                        }}
                      />
                    </>
                  )}
                </Dropdown>
              </span>
            </div>
          );
        })}
      </div>

      {!loading && !visible.length && !childFolders.length && (
        <div className="dropzone">
          <IconCloudUpload width={44} height={44} />
          <p>
            {query.trim()
              ? "Nothing matches that search."
              : "Export your sequence to begin."}
          </p>
          {!query.trim() && (
            <button className="primary" onClick={onExport} disabled={!host.ok}>
              {host.ok ? `Export ${host.sequenceName}` : "Open a sequence in Premiere"}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
