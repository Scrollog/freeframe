"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Maximize,
  Minimize,
  Pause,
  Play,
  Volume2,
  VolumeX,
  ChevronUp,
  ChevronRight,
  Check,
  Repeat,
  Settings,
  Gauge,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { cn, formatTime, formatTimecode, formatFrames } from "@/lib/utils";
import { renderedMediaBox } from "@/lib/media-frame";
import { api } from "@/lib/api";
import { useReviewStore, type TimeFormat } from "@/stores/review-store";
import { useVideoPlayer } from "@/hooks/use-video-player";
import { useReview } from "./review-provider";
import { ProgressBar } from "./progress-bar";
import type { Comment } from "@/types";

// ─── Types ────────────────────────────────────────────────────────────────────

interface StreamUrlResponse {
  url: string;
}

interface VideoPlayerProps {
  assetId: string;
  comments?: Comment[];
  overlay?: React.ReactNode;
  className?: string;
  /** Pre-fetched stream URL (for share mode — skips authenticated API call) */
  initialStreamUrl?: string | null;
}

// ─── Video frame constraint ──────────────────────────────────────────────────

/**
 * Wraps children so they are positioned exactly over the visible video frame,
 * excluding the black letterbox bars created by object-contain.
 *
 * Exported for the compare overlay: annotations are AUTHORED inside this
 * constraint (video-frame coordinates), so any viewer that renders them must
 * mount the overlay in the same space.
 */
export function VideoFrameConstraint({
  videoRef,
  children,
}: {
  videoRef: React.RefObject<HTMLVideoElement>;
  children: React.ReactNode;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const calc = () => {
      // Measured from the element's own box, exactly like the image constraint.
      // The main player's <video> is `w-full h-full object-contain`, so its box
      // IS the container and this reduces to fitting against the container. The
      // compare panes use `max-h-full max-w-full`, where the element only ever
      // shrinks and so already hugs the picture — deriving the fit from the
      // container there would upscale the box and misplace every annotation.
      const box = renderedMediaBox({
        naturalWidth: video.videoWidth,
        naturalHeight: video.videoHeight,
        elementWidth: video.offsetWidth,
        elementHeight: video.offsetHeight,
        offsetLeft: video.offsetLeft,
        offsetTop: video.offsetTop,
      });

      if (!box) {
        // Not laid out yet — fill the container and recompute on the next
        // loadedmetadata/resize.
        setStyle({ position: "absolute", inset: 0 });
        return;
      }

      setStyle({
        position: "absolute",
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
      });
    };

    calc();
    video.addEventListener("loadedmetadata", calc);
    video.addEventListener("resize", calc);

    // Observe both: under `max-*` a container resize only RECENTRES the element,
    // moving offsetLeft/offsetTop without changing its own box, and
    // ResizeObserver does not fire on a position-only change.
    const ro = new ResizeObserver(calc);
    ro.observe(video);
    if (video.parentElement) ro.observe(video.parentElement);

    return () => {
      video.removeEventListener("loadedmetadata", calc);
      video.removeEventListener("resize", calc);
      ro.disconnect();
    };
  }, [videoRef]);

  return (
    <div ref={wrapperRef} style={style} className="overflow-hidden">
      {children}
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const EDGE_SEEK_ZONE = 0.18;
const EDGE_SECOND_CLICK_WINDOW_MS = 400;
const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.25;

export function getEdgeSeekDelta(offsetX: number, width: number): number {
  if (width <= 0) return 0;
  if (offsetX <= width * EDGE_SEEK_ZONE) return -2;
  if (offsetX >= width * (1 - EDGE_SEEK_ZONE)) return 2;
  return 0;
}

export function isRapidRepeatEdgeClick(
  previous: { side: number; at: number } | null,
  side: number,
  now: number,
): boolean {
  return previous?.side === side && now - previous.at <= EDGE_SECOND_CLICK_WINDOW_MS;
}

export function VideoPlayer({
  assetId,
  comments = [],
  overlay,
  className,
  initialStreamUrl,
}: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mediaAreaRef = useRef<HTMLDivElement>(null);
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const didZoomGestureRef = useRef(false);
  const [streamUrl, setStreamUrl] = useState<string | null>(null);
  const [loop, setLoop] = useState(false);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [zoomOrigin, setZoomOrigin] = useState({ x: 50, y: 50 });
  const edgeClickRef = useRef<{ side: number; at: number } | null>(null);

  const { isDrawingMode, timeFormat, setTimeFormat, setPlayheadTime, currentVersion } =
    useReviewStore();
  const { registerPauseHandler } = useReview();
  const [timeFormatOpen, setTimeFormatOpen] = useState(false);
  const timeFormatRef = useRef<HTMLDivElement>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsView, setSettingsView] = useState<"main" | "quality" | "speed" | "zoom">("main");
  const settingsRef = useRef<HTMLDivElement>(null);

  // Close time format dropdown on outside click
  useEffect(() => {
    if (!timeFormatOpen) return;
    const handleClick = (e: MouseEvent) => {
      if (
        timeFormatRef.current &&
        !timeFormatRef.current.contains(e.target as Node)
      )
        setTimeFormatOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [timeFormatOpen]);

  useEffect(() => {
    if (!settingsOpen) return;
    const handleClick = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setSettingsOpen(false);
        setSettingsView("main");
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [settingsOpen]);

  function displayTime(seconds: number): string {
    switch (timeFormat) {
      case "frames":
        return formatFrames(seconds);
      case "standard":
        return formatTime(seconds);
      case "timecode":
        return formatTimecode(seconds);
      default:
        return formatTimecode(seconds);
    }
  }

  // Load the stream URL — reset immediately on asset OR version change so the old
  // video doesn't keep playing while the new URL is being fetched.
  const versionId = currentVersion?.id;
  useEffect(() => {
    // Guard against a superseded fetch: rapid version switching starts overlapping
    // requests, and without this a slower earlier response could land last and leave
    // the player on the wrong version's stream.
    let ignore = false;
    setStreamUrl(null);
    if (initialStreamUrl) {
      const resolved = initialStreamUrl.startsWith("/")
        ? `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${initialStreamUrl}`
        : initialStreamUrl;
      setStreamUrl(resolved);
      return;
    }
    // Pin the stream to the selected version — without version_id the API falls
    // back to the latest version, so the switcher never actually changes the
    // playing stream (#66).
    const streamPath = versionId
      ? `/assets/${assetId}/stream?version_id=${versionId}`
      : `/assets/${assetId}/stream`;
    api
      .get<StreamUrlResponse>(streamPath)
      .then((data) => {
        if (ignore) return;
        // HLS proxy returns relative paths — prepend API URL
        const url = data.url.startsWith("/")
          ? `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}${data.url}`
          : data.url;
        setStreamUrl(url);
      })
      .catch(() => {
        /* stream URL errors handled by player error state */
      });
    return () => {
      ignore = true;
    };
  }, [assetId, initialStreamUrl, versionId]);

  const player = useVideoPlayer(streamUrl);

  const {
    videoRef,
    isPlaying,
    currentTime,
    duration,
    buffered,
    volume,
    isMuted,
    playbackRate,
    qualityLevels,
    currentQuality,
    isLoading,
    isFullscreen,
    error,
    pause,
    togglePlay,
    seek,
    fastSeek,
    setPlaybackRate,
    setQuality,
    setVolume,
    toggleMute,
    toggleFullscreen,
  } = player;

  // Register pause handler with review provider
  useEffect(() => {
    registerPauseHandler(pause);
  }, [registerPauseHandler, pause]);

  // Sync video currentTime to review store so comment input shows same timecode
  const lastSyncRef = useRef(0);
  useEffect(() => {
    const now = Date.now();
    if (now - lastSyncRef.current > 100) {
      setPlayheadTime(currentTime);
      lastSyncRef.current = now;
    }
  }, [currentTime, setPlayheadTime]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        isDrawingMode
      ) {
        return;
      }

      switch (e.code) {
        case "Digit0":
        case "Numpad0":
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setZoom(MIN_ZOOM);
            setZoomOrigin({ x: 50, y: 50 });
          }
          break;
        case "Space":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          seek(currentTime - 5);
          break;
        case "ArrowRight":
          e.preventDefault();
          seek(currentTime + 5);
          break;
        case "KeyJ":
          seek(currentTime - 10);
          break;
        case "KeyK":
          togglePlay();
          break;
        case "KeyL":
          seek(currentTime + 10);
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [togglePlay, seek, currentTime, isDrawingMode]);

  const changeZoom = useCallback((amount: number) => {
    setZoom((current) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current + amount)));
  }, []);

  const setZoomOriginFromPoint = useCallback((clientX: number, clientY: number) => {
    const rect = mediaAreaRef.current?.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return;
    setZoomOrigin({
      x: Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100)),
      y: Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100)),
    });
  }, []);

  const resetZoom = useCallback(() => {
    setZoom(MIN_ZOOM);
    setZoomOrigin({ x: 50, y: 50 });
  }, []);

  // Prevent Ctrl + wheel from changing browser zoom while the pointer is over
  // the player, and use it to scale the media instead.
  useEffect(() => {
    const mediaArea = mediaAreaRef.current;
    if (!mediaArea) return;

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      setZoomOriginFromPoint(event.clientX, event.clientY);
      changeZoom(event.deltaY < 0 ? ZOOM_STEP : -ZOOM_STEP);
    };

    mediaArea.addEventListener("wheel", handleWheel, { passive: false });
    return () => mediaArea.removeEventListener("wheel", handleWheel);
  }, [changeZoom, setZoomOriginFromPoint]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointersRef.current.size === 2) {
      const [first, second] = Array.from(activePointersRef.current.values());
      pinchRef.current = {
        distance: Math.hypot(first.x - second.x, first.y - second.y),
        zoom,
      };
    }
  }, [zoom]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (!activePointersRef.current.has(event.pointerId)) return;
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointersRef.current.size !== 2 || !pinchRef.current) return;

    const [first, second] = Array.from(activePointersRef.current.values());
    const distance = Math.hypot(first.x - second.x, first.y - second.y);
    if (!pinchRef.current.distance) return;

    const nextZoom = Math.min(
      MAX_ZOOM,
      Math.max(MIN_ZOOM, pinchRef.current.zoom * (distance / pinchRef.current.distance)),
    );
    if (Math.abs(nextZoom - zoom) > 0.01) {
      event.preventDefault();
      didZoomGestureRef.current = true;
      setZoomOriginFromPoint((first.x + second.x) / 2, (first.y + second.y) / 2);
      setZoom(nextZoom);
    }
  }, [setZoomOriginFromPoint, zoom]);

  const handlePointerEnd = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    activePointersRef.current.delete(event.pointerId);
    if (activePointersRef.current.size < 2) pinchRef.current = null;
  }, []);

  const handleContainerClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (didZoomGestureRef.current) {
      didZoomGestureRef.current = false;
      return;
    }
    if (isDrawingMode) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const delta = getEdgeSeekDelta(event.clientX - bounds.left, bounds.width);
    if (!delta) {
      edgeClickRef.current = null;
      togglePlay();
      return;
    }

    const now = Date.now();
    const side = Math.sign(delta);
    if (isRapidRepeatEdgeClick(edgeClickRef.current, side, now)) {
      seek(currentTime + delta);
      edgeClickRef.current = null;
      return;
    }
    edgeClickRef.current = { side, at: now };
  }, [togglePlay, seek, currentTime, isDrawingMode]);

  const handleFullscreen = useCallback(() => {
    if (containerRef.current) {
      toggleFullscreen(containerRef.current);
    }
  }, [toggleFullscreen]);

  const qualityLabel = currentQuality === -1
    ? "Auto"
    : qualityLevels.find((level) => level.index === currentQuality)?.label ?? "Auto";

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    setSettingsView("main");
  }, []);

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-col h-full w-full",
        isFullscreen && "fixed inset-0 z-50",
        className,
      )}
    >
      {/* Video area — fills available space, object-contain preserves aspect ratio with letterbox */}
      <div
        ref={mediaAreaRef}
        className="flex-1 relative min-h-0 bg-black overflow-hidden cursor-pointer touch-none"
        onClick={handleContainerClick}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
      >
        <div
          className="absolute inset-0 origin-center transition-transform duration-100 ease-out"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: `${zoomOrigin.x}% ${zoomOrigin.y}%`,
          }}
        >
          <video
            ref={videoRef}
            className={cn(
              "absolute inset-0 w-full h-full object-contain",
              isDrawingMode ? "pointer-events-none" : "",
            )}
            playsInline
            preload="metadata"
          />

          {/* Overlay slot (annotation canvas / overlay) — constrained to video frame */}
          {overlay && (
            <VideoFrameConstraint videoRef={videoRef}>
              {overlay}
            </VideoFrameConstraint>
          )}
        </div>

        {/* Loading spinner */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

      </div>

      {/* Progress bar */}
      <div className="shrink-0 bg-black">
        <ProgressBar
          currentTime={currentTime}
          duration={duration}
          buffered={buffered}
          comments={comments}
          streamUrl={streamUrl}
          onSeek={seek}
          onScrubSeek={fastSeek}
        />
      </div>

      {/* Bottom transport bar (matches audio player style) */}
      <div className="flex items-center justify-between h-12 px-4 bg-bg-secondary/80 shrink-0">
        {/* Left: Play, Volume */}
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className="flex h-7 w-7 items-center justify-center rounded text-text-primary hover:bg-bg-hover transition-colors"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="h-4 w-4" />
            )}
          </button>

          <button
            onClick={toggleMute}
            className="flex h-7 w-7 items-center justify-center rounded text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-colors"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? (
              <VolumeX className="h-4 w-4" />
            ) : (
              <Volume2 className="h-4 w-4" />
            )}
          </button>
        </div>

        {/* Center: Timecode display with format picker */}
        <div className="relative" ref={timeFormatRef}>
          <button
            onClick={() => setTimeFormatOpen((p) => !p)}
            className="flex items-center gap-1.5 rounded-md bg-bg-tertiary px-3 py-1 hover:bg-bg-hover transition-colors"
          >
            <span className="font-mono text-sm text-text-primary tabular-nums tracking-wide">
              {timeFormat === "timecode" ? (
                displayTime(currentTime)
              ) : (
                <>
                  {displayTime(currentTime)}{" "}
                  <span className="text-text-tertiary">/</span>{" "}
                  {displayTime(duration)}
                </>
              )}
            </span>
            <ChevronUp
              className={cn(
                "h-3 w-3 text-text-tertiary transition-transform",
                timeFormatOpen && "rotate-180",
              )}
            />
          </button>
          {timeFormatOpen && (
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-48 rounded-xl border border-white/10 bg-[#2a2a30] shadow-2xl py-1.5 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-2 text-[11px] text-text-tertiary uppercase tracking-wider font-medium">
                Time Format
              </div>
              {(
                [
                  { id: "frames" as TimeFormat, label: "Frames" },
                  { id: "standard" as TimeFormat, label: "Standard" },
                  { id: "timecode" as TimeFormat, label: "Timecode" },
                ] as const
              ).map((item) => (
                <button
                  key={item.id}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-[13px] transition-colors",
                    timeFormat === item.id
                      ? "text-text-primary"
                      : "text-text-secondary hover:bg-white/5",
                  )}
                  onClick={() => {
                    setTimeFormat(item.id);
                    setTimeFormatOpen(false);
                  }}
                >
                  {item.label}
                  {timeFormat === item.id && (
                    <Check className="h-4 w-4 text-accent" />
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Right: Player settings, Fullscreen */}
        <div className="flex items-center gap-2">
          <div className="relative" ref={settingsRef}>
            <button
              onClick={() => {
                setSettingsOpen((open) => !open);
                setSettingsView("main");
              }}
              className="flex h-7 w-7 items-center justify-center rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
              aria-label="Player settings"
              aria-expanded={settingsOpen}
            >
              <Settings className="h-4 w-4" />
            </button>
            {settingsOpen && (
              <div className="absolute bottom-full right-0 mb-2 z-50 w-56 overflow-hidden rounded-xl border border-border bg-bg-elevated py-1 shadow-2xl animate-in fade-in zoom-in-95 duration-100">
                {settingsView === "main" ? (
                  <>
                    {qualityLevels.length > 0 && (
                      <button
                        onClick={() => setSettingsView("quality")}
                        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-text-primary hover:bg-bg-hover transition-colors"
                      >
                        <Settings className="h-4 w-4 text-text-tertiary" />
                        <span className="flex-1">Quality</span>
                        <span className="text-xs text-text-tertiary">{qualityLabel}</span>
                        <ChevronRight className="h-4 w-4 text-text-tertiary" />
                      </button>
                    )}
                    <button
                      onClick={() => setSettingsView("speed")}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-text-primary hover:bg-bg-hover transition-colors"
                    >
                      <Gauge className="h-4 w-4 text-text-tertiary" />
                      <span className="flex-1">Playback speed</span>
                      <span className="text-xs text-text-tertiary">{playbackRate}x</span>
                      <ChevronRight className="h-4 w-4 text-text-tertiary" />
                    </button>
                    <button
                      onClick={() => setSettingsView("zoom")}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-text-primary hover:bg-bg-hover transition-colors"
                    >
                      <ZoomIn className="h-4 w-4 text-text-tertiary" />
                      <span className="flex-1">Zoom</span>
                      <span className="text-xs text-text-tertiary">
                        {zoom === MIN_ZOOM ? "Fit" : `${Math.round(zoom * 100)}%`}
                      </span>
                      <ChevronRight className="h-4 w-4 text-text-tertiary" />
                    </button>
                    <button
                      onClick={() => setLoop((enabled) => !enabled)}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-text-primary hover:bg-bg-hover transition-colors"
                    >
                      <Repeat className="h-4 w-4 text-text-tertiary" />
                      <span className="flex-1">Loop</span>
                      <span className={cn("h-4 w-7 rounded-full p-0.5 transition-colors", loop ? "bg-accent" : "bg-bg-hover")}>
                        <span className={cn("block h-3 w-3 rounded-full bg-white transition-transform", loop && "translate-x-3")} />
                      </span>
                    </button>
                  </>
                ) : settingsView === "zoom" ? (
                  <>
                    <button
                      onClick={() => setSettingsView("main")}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-text-secondary hover:bg-bg-hover transition-colors"
                    >
                      <ChevronRight className="h-4 w-4 rotate-180" />
                      Zoom
                    </button>
                    <button
                      onClick={() => changeZoom(ZOOM_STEP)}
                      disabled={zoom >= MAX_ZOOM}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-text-primary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                    >
                      <ZoomIn className="h-4 w-4 text-text-tertiary" />
                      <span className="flex-1">Zoom in</span>
                      <span className="text-text-tertiary">+</span>
                    </button>
                    <button
                      onClick={() => changeZoom(-ZOOM_STEP)}
                      disabled={zoom <= MIN_ZOOM}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-text-primary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                    >
                      <ZoomOut className="h-4 w-4 text-text-tertiary" />
                      <span className="flex-1">Zoom out</span>
                      <span className="text-text-tertiary">−</span>
                    </button>
                    <button
                      onClick={resetZoom}
                      disabled={zoom === MIN_ZOOM}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-sm text-text-primary hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
                    >
                      <Settings className="h-4 w-4 text-text-tertiary" />
                      <span className="flex-1">Zoom to 100%</span>
                      <span className="rounded bg-bg-hover px-1.5 py-0.5 text-[10px] font-medium text-text-secondary">Ctrl+0</span>
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setSettingsView("main")}
                      className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-text-secondary hover:bg-bg-hover transition-colors"
                    >
                      <ChevronRight className="h-4 w-4 rotate-180" />
                      {settingsView === "quality" ? "Quality" : "Playback speed"}
                    </button>
                    {(settingsView === "quality"
                      ? [...[...qualityLevels].reverse(), { index: -1, label: "Auto" }]
                      : SPEED_OPTIONS.map((rate) => ({ index: rate, label: `${rate}x` }))
                    ).map((option) => {
                      const selected = settingsView === "quality"
                        ? currentQuality === option.index
                        : playbackRate === option.index;
                      return (
                        <button
                          key={option.index}
                          onClick={() => {
                            if (settingsView === "quality") setQuality(option.index);
                            else setPlaybackRate(option.index);
                            closeSettings();
                          }}
                          className="flex w-full items-center justify-between px-3 py-2.5 text-sm text-text-primary hover:bg-bg-hover transition-colors"
                        >
                          {option.label}
                          {selected && <Check className="h-4 w-4 text-accent" />}
                        </button>
                      );
                    })}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Fullscreen */}
          <button
            onClick={handleFullscreen}
            className="flex h-7 w-7 items-center justify-center rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors"
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          >
            {isFullscreen ? (
              <Minimize className="h-4 w-4" />
            ) : (
              <Maximize className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
