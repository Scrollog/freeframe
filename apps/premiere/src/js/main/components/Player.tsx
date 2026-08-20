/**
 * Video player for the review tab: HLS playback plus a scrub bar that shows
 * where every comment sits, the way the FreeFrame web viewer does.
 */
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import type { FreeFrameApi } from "../../lib/freeframe/api";
import type { Comment } from "../../lib/freeframe/types";
import { formatTimecode } from "../../lib/freeframe/timecode";
import { Dropdown, MenuRadio } from "./Dropdown";
import { AnnotationOverlay } from "./AnnotationOverlay";
import {
  IconChevronUp,
  IconLoop,
  IconPause,
  IconPlay,
  IconSkipBack,
  IconSkipForward,
  IconVolume,
  IconVolumeOff,
} from "./Icons";

const SPEEDS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

type TimeMode = "timecode" | "frames" | "seconds";

const TIME_MODES: { key: TimeMode; label: string }[] = [
  { key: "timecode", label: "Timecode" },
  { key: "frames", label: "Frames" },
  { key: "seconds", label: "Seconds" },
];

export interface PlayerHandle {
  seek: (seconds: number) => void;
  currentTime: () => number;
}

interface PlayerProps {
  api: FreeFrameApi;
  assetId: string;
  versionId: string;
  comments: Comment[];
  fps?: number;
  /** Fabric drawing to replay over the picture, or null for none. */
  annotation?: Record<string, unknown> | null;
  onTimeUpdate?: (seconds: number) => void;
  onSelectComment?: (comment: Comment) => void;
}

export const Player = forwardRef<PlayerHandle, PlayerProps>(
  (
    { api, assetId, versionId, comments, fps, annotation, onTimeUpdate, onSelectComment },
    ref
  ) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [src, setSrc] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [playing, setPlaying] = useState(false);
    const [muted, setMuted] = useState(false);
    const [volume, setVolume] = useState(1);
    const [loop, setLoop] = useState(false);
    const [speed, setSpeed] = useState(1);
    const [time, setTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [dragging, setDragging] = useState(false);
    const [timeMode, setTimeMode] = useState<TimeMode>("timecode");
    const [preview, setPreview] = useState<{ x: number; time: number } | null>(null);
    const scrubRef = useRef<HTMLDivElement>(null);
    const previewRef = useRef<HTMLVideoElement>(null);
    const previewHls = useRef<{ destroy: () => void } | null>(null);
    const previewAttached = useRef(false);
    const lastPreviewSeek = useRef(0);

    useImperativeHandle(ref, () => ({
      seek: (seconds: number) => {
        const video = videoRef.current;
        if (!video) return;
        video.currentTime = seconds;
        setTime(seconds);
      },
      currentTime: () => videoRef.current?.currentTime ?? 0,
    }));

    useEffect(() => {
      let cancelled = false;
      setLoading(true);
      setError("");
      setSrc("");
      (async () => {
        try {
          const { url } = await api.stream(assetId, versionId || undefined);
          if (!cancelled) setSrc(url);
        } catch (e) {
          if (!cancelled) {
            setError(e instanceof Error ? e.message : String(e));
            setLoading(false);
          }
        }
      })();
      return () => {
        cancelled = true;
      };
    }, [api, assetId, versionId]);

    // CEP's Chromium has no native HLS, so hand .m3u8 sources to hls.js.
    useEffect(() => {
      const video = videoRef.current;
      if (!video || !src) return;
      if (!src.includes(".m3u8")) {
        video.src = src;
        return;
      }
      let destroy = () => {};
      import("hls.js").then(({ default: Hls }) => {
        if (!videoRef.current) return;
        if (!Hls.isSupported()) {
          setError("HLS playback is unavailable in this panel.");
          return;
        }
        const hls = new Hls({ enableWorker: false });
        hls.loadSource(src);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) setError(`Playback error: ${data.details}`);
        });
        destroy = () => hls.destroy();
      });
      return () => destroy();
    }, [src]);

    // Rate resets whenever the element gets a new source.
    useEffect(() => {
      if (videoRef.current) videoRef.current.playbackRate = speed;
    }, [speed, src]);

    const timed = useMemo(
      () =>
        comments.filter(
          (c) => c.timecode_start !== null && c.timecode_start !== undefined
        ),
      [comments]
    );

    const togglePlay = useCallback(() => {
      const video = videoRef.current;
      if (!video) return;
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    }, []);

    /** One frame at a time when the rate is known, else a small nudge. */
    const stepFrame = (direction: 1 | -1) => {
      const video = videoRef.current;
      if (!video) return;
      video.pause();
      const delta = fps && fps > 0 ? 1 / fps : 0.04;
      video.currentTime = Math.min(
        duration || video.duration || 0,
        Math.max(0, video.currentTime + delta * direction)
      );
    };

    // -- scrubbing ------------------------------------------------------------

    const timeAt = (clientX: number): number => {
      const bar = scrubRef.current;
      if (!bar || !duration) return 0;
      const bounds = bar.getBoundingClientRect();
      const ratio = Math.min(1, Math.max(0, (clientX - bounds.left) / bounds.width));
      return ratio * duration;
    };

    /** Press and drag anywhere on the bar, the way a video player should feel. */
    const onScrubDown = (event: React.MouseEvent<HTMLDivElement>) => {
      const video = videoRef.current;
      if (!video || !duration) return;
      event.preventDefault();
      setDragging(true);
      video.currentTime = timeAt(event.clientX);

      const onMove = (move: MouseEvent) => {
        video.currentTime = timeAt(move.clientX);
        setTime(video.currentTime);
        showPreview(move.clientX);
      };
      const onUp = () => {
        setDragging(false);
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    };

    /**
     * Hover preview. A second, muted video element is attached lazily the first
     * time the bar is hovered — building it up front would double the HLS
     * buffering for a feature most sessions never touch. Seeks are throttled
     * because a seek per mousemove stalls the decoder.
     */
    const ensurePreview = useCallback(() => {
      const node = previewRef.current;
      if (!node || !src || previewAttached.current) return;
      previewAttached.current = true;
      if (!src.includes(".m3u8")) {
        node.src = src;
        return;
      }
      import("hls.js").then(({ default: Hls }) => {
        if (!previewRef.current || !Hls.isSupported()) return;
        // Lowest rendition is plenty for a 160px-wide thumbnail.
        const hls = new Hls({ enableWorker: false, startLevel: 0, capLevelToPlayerSize: true });
        hls.loadSource(src);
        hls.attachMedia(previewRef.current);
        previewHls.current = hls;
      });
    }, [src]);

    const showPreview = (clientX: number) => {
      const bar = scrubRef.current;
      if (!bar || !duration) return;
      ensurePreview();
      const bounds = bar.getBoundingClientRect();
      const at = timeAt(clientX);
      setPreview({ x: clientX - bounds.left, time: at });

      const node = previewRef.current;
      const now = Date.now();
      if (node && now - lastPreviewSeek.current > 90) {
        lastPreviewSeek.current = now;
        try {
          node.currentTime = at;
        } catch (e) {
          // Seeking before the media is ready throws; the next move retries.
        }
      }
    };

    // Tear the preview stream down with the component or a version change.
    useEffect(() => {
      previewAttached.current = false;
      return () => {
        previewHls.current?.destroy();
        previewHls.current = null;
      };
    }, [src]);

    const progress = duration ? (time / duration) * 100 : 0;

    /** The readout honours the format picked in the time dropdown. */
    const readout = (seconds: number): string => {
      if (timeMode === "frames") {
        return String(Math.round(seconds * (fps && fps > 0 ? fps : 25)));
      }
      if (timeMode === "seconds") return formatTimecode(seconds);
      return formatTimecode(seconds, fps);
    };

    return (
      <div className="player">
        <div className="stage">
          <video
            ref={videoRef}
            playsInline
            loop={loop}
            onClick={togglePlay}
            onLoadedMetadata={(e) => {
              setDuration(e.currentTarget.duration || 0);
              setLoading(false);
            }}
            onTimeUpdate={(e) => {
              setTime(e.currentTarget.currentTime);
              onTimeUpdate?.(e.currentTarget.currentTime);
            }}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />
          <AnnotationOverlay drawing={annotation ?? null} />
          {loading && !error && <div className="stage-overlay">Loading…</div>}
          {error && <div className="stage-overlay error">{error}</div>}
        </div>

        <div
          className={`scrub${dragging ? " dragging" : ""}`}
          ref={scrubRef}
          onMouseDown={onScrubDown}
          onMouseMove={(event) => showPreview(event.clientX)}
          onMouseLeave={() => !dragging && setPreview(null)}
        >
          <div className="scrub-track">
            <div className="scrub-fill" style={{ width: `${progress}%` }} />
          </div>
          {duration > 0 &&
            timed.map((comment) => (
              <button
                key={comment.id}
                className={`pip${comment.resolved ? " done" : ""}`}
                style={{ left: `${((comment.timecode_start as number) / duration) * 100}%` }}
                title={`${formatTimecode(comment.timecode_start, fps)} — ${comment.body}`}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectComment?.(comment);
                }}
              />
            ))}
          <div className="playhead" style={{ left: `${progress}%` }}>
            <span className="knob" />
          </div>

          {preview && duration > 0 && (
            <div
              className="scrub-preview"
              // Clamped so the card never hangs off either end of the bar.
              style={{
                left: `${Math.min(
                  Math.max(preview.x, 84),
                  (scrubRef.current?.clientWidth ?? 0) - 84
                )}px`,
              }}
            >
              <video ref={previewRef} muted playsInline preload="auto" />
              <span>{formatTimecode(preview.time, fps)}</span>
            </div>
          )}
        </div>

        <div className="player-bar">
          <button
            className="icon-btn"
            onClick={() => stepFrame(-1)}
            title="Previous frame"
          >
            <IconSkipBack width={14} height={14} />
          </button>
          <button className="icon-btn play" onClick={togglePlay} title={playing ? "Pause" : "Play"}>
            {playing ? <IconPause /> : <IconPlay />}
          </button>
          <button className="icon-btn" onClick={() => stepFrame(1)} title="Next frame">
            <IconSkipForward width={14} height={14} />
          </button>

          <span className="bar-gap" />

          <Dropdown
            triggerClass="text-btn speed"
            title="Playback speed"
            trigger={<>{speed}x</>}
          >
            {(close) =>
              SPEEDS.map((rate) => (
                <MenuRadio
                  key={rate}
                  label={`${rate}x`}
                  checked={speed === rate}
                  onSelect={() => {
                    setSpeed(rate);
                    close();
                  }}
                />
              ))
            }
          </Dropdown>
          <button
            className={`icon-btn${loop ? " accented" : ""}`}
            onClick={() => setLoop((value) => !value)}
            title={loop ? "Loop on" : "Loop off"}
          >
            <IconLoop width={15} height={15} />
          </button>
          <span className="volume">
            <button
              className="icon-btn"
              onClick={() => {
                const video = videoRef.current;
                if (!video) return;
                video.muted = !video.muted;
                setMuted(video.muted);
              }}
              title={muted ? "Unmute" : "Mute"}
            >
              {muted || volume === 0 ? <IconVolumeOff /> : <IconVolume />}
            </button>
            <input
              className="volume-slider"
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={muted ? 0 : volume}
              title="Volume"
              onChange={(e) => {
                const next = Number(e.target.value);
                const video = videoRef.current;
                setVolume(next);
                if (!video) return;
                video.volume = next;
                // Dragging off zero should also lift a previous mute.
                video.muted = next === 0;
                setMuted(video.muted);
              }}
            />
          </span>

          <span className="bar-gap" />

          <Dropdown
            up
            triggerClass="tc-box"
            title="Time display"
            trigger={
              <>
                {readout(time)}
                <IconChevronUp width={11} height={11} />
              </>
            }
          >
            {(close) => (
              <>
                {TIME_MODES.map((mode) => (
                  <MenuRadio
                    key={mode.key}
                    label={mode.label}
                    checked={timeMode === mode.key}
                    onSelect={() => {
                      setTimeMode(mode.key);
                      close();
                    }}
                  />
                ))}
                <div className="menu-sep">Duration</div>
                <div className="menu-field">{readout(duration)}</div>
              </>
            )}
          </Dropdown>
        </div>
      </div>
    );
  }
);

Player.displayName = "Player";
