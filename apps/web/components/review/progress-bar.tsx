'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Hls from 'hls.js'
import { Globe, Lock, X } from 'lucide-react'
import { cn, formatTimecode } from '@/lib/utils'
import { buildCommentNumbers } from '@/lib/comment-numbers'
import { useReviewStore } from '@/stores/review-store'
import type { Comment } from '@/types'

// ─── Avatar helpers ───────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#E67E22', '#E74C3C', '#9B59B6', '#3498DB', '#1ABC9C',
  '#2ECC71', '#F39C12', '#D35400', '#8E44AD', '#2980B9',
]

export function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase()
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase()
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProgressBarProps {
  currentTime: number
  duration: number
  buffered?: number
  comments?: Comment[]
  videoRef?: React.RefObject<HTMLVideoElement | null>
  streamUrl?: string | null
  onSeek: (time: number) => void
  className?: string
}

// ─── Frame Preview Hook ───────────────────────────────────────────────────────

function useFramePreview(streamUrl: string | null | undefined) {
  const previewVideoRef = useRef<HTMLVideoElement | null>(null)
  const previewHlsRef = useRef<Hls | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const seekResolveRef = useRef<(() => void) | null>(null)
  const readyRef = useRef(false)
  const [previewImage, setPreviewImage] = useState<string | null>(null)

  // Initialize hidden preview video + HLS
  useEffect(() => {
    if (!streamUrl) return

    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.crossOrigin = 'anonymous'
    video.style.display = 'none'
    document.body.appendChild(video)
    previewVideoRef.current = video

    const canvas = document.createElement('canvas')
    canvas.width = 160
    canvas.height = 90
    canvasRef.current = canvas

    const isHls = streamUrl.includes('.m3u8')

    const onReady = () => {
      readyRef.current = true
    }

    video.addEventListener('loadeddata', onReady)

    video.addEventListener('seeked', () => {
      // Capture frame
      try {
        const ctx = canvas.getContext('2d')
        if (ctx && video.videoWidth > 0) {
          const aspectRatio = video.videoWidth / video.videoHeight
          const w = 160
          const h = Math.round(w / aspectRatio)
          canvas.width = w
          canvas.height = h
          ctx.drawImage(video, 0, 0, w, h)
          setPreviewImage(canvas.toDataURL('image/jpeg', 0.7))
        }
      } catch {
        // CORS — silently fail
      }
      seekResolveRef.current?.()
      seekResolveRef.current = null
    })

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: false,
        maxBufferLength: 1,
        maxMaxBufferLength: 2,
        maxBufferSize: 0.5 * 1024 * 1024, // 500KB — minimal buffering
      })
      previewHlsRef.current = hls
      hls.loadSource(streamUrl)
      hls.attachMedia(video)
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl
    } else {
      video.src = streamUrl
    }

    return () => {
      readyRef.current = false
      if (previewHlsRef.current) {
        previewHlsRef.current.destroy()
        previewHlsRef.current = null
      }
      video.removeEventListener('loadeddata', onReady)
      video.src = ''
      video.remove()
      previewVideoRef.current = null
      canvasRef.current = null
      setPreviewImage(null)
    }
  }, [streamUrl])

  const seekPreview = useCallback((time: number) => {
    const video = previewVideoRef.current
    if (!video || !readyRef.current) return
    // Debounce: if already seeking, skip
    if (seekResolveRef.current) return
    seekResolveRef.current = () => {}
    video.currentTime = Math.max(0, time)
  }, [])

  const clearPreview = useCallback(() => {
    setPreviewImage(null)
  }, [])

  return { previewImage, seekPreview, clearPreview }
}

// ─── Comment Marker ──────────────────────────────────────────────────────────

interface CommentMarkerProps {
  comment: Comment
  /** Canonical number shared with the side panel — NOT the marker's array position. */
  commentNumber?: number
  leftPercent: number
  rightPercent?: number
  authorName: string
  initials: string
  color: string
  isHovered: boolean
  isFocused: boolean
  onHover: () => void
  onLeave: () => void
  onSeek: (time: number) => void
}

function CommentMarker({
  comment,
  commentNumber,
  leftPercent,
  rightPercent,
  authorName,
  initials,
  color,
  isHovered,
  isFocused,
  onHover,
  onLeave,
  onSeek,
}: CommentMarkerProps) {
  const markerRef = useRef<HTMLDivElement>(null)
  const setFocusedCommentId = useReviewStore((s) => s.setFocusedCommentId)
  const setActiveAnnotation = useReviewStore((s) => s.setActiveAnnotation)
  const seekTo = useReviewStore((s) => s.seekTo)
  const [tooltipPos, setTooltipPos] = useState<{ left: number; top: number } | null>(null)

  // Recalculate tooltip position when hovered to avoid viewport clipping
  useEffect(() => {
    if (!isHovered || !markerRef.current) {
      setTooltipPos(null)
      return
    }
    const rect = markerRef.current.getBoundingClientRect()
    const tooltipWidth = 240
    let left = rect.left + rect.width / 2 - tooltipWidth / 2
    if (left < 8) left = 8
    if (left + tooltipWidth > window.innerWidth - 8) left = window.innerWidth - 8 - tooltipWidth
    setTooltipPos({ left, top: rect.top - 8 })
  }, [isHovered])

  const handleClick = useCallback(() => {
    if (comment.timecode_start !== null) {
      seekTo(comment.timecode_start, true)
    }
    setFocusedCommentId(comment.id)
    if ((comment as any).annotation?.drawing_data) {
      setActiveAnnotation((comment as any).annotation.drawing_data)
    } else {
      setActiveAnnotation(null)
    }
  }, [comment, seekTo, setFocusedCommentId, setActiveAnnotation])

  return (
    <div
      ref={markerRef}
      className={cn(
        'absolute top-0 cursor-pointer',
        rightPercent === undefined && '-translate-x-1/2',
      )}
      style={{
        left: `${leftPercent}%`,
        width: rightPercent === undefined ? undefined : `${Math.max(0, rightPercent - leftPercent)}%`,
      }}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      onClick={handleClick}
    >
      {rightPercent !== undefined && (
        <div
          className={cn(
            'absolute left-0 right-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white transition-opacity',
            isFocused ? 'opacity-100' : 'opacity-90',
          )}
        />
      )}

      {/* Avatar dot */}
      <div
        className={cn(
          'relative flex items-center justify-center overflow-hidden rounded-full font-bold leading-none text-white shadow-md border-2 transition-transform hover:scale-110',
          rightPercent === undefined ? 'w-5 h-5 text-[9px]' : 'w-5 h-5 -translate-x-1/2 text-[9px]',
          isFocused ? 'border-accent scale-125' : 'border-bg-primary',
        )}
        style={{ backgroundColor: color }}
      >
        {comment.author?.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={comment.author.avatar_url} alt="" className="h-full w-full object-cover" />
        ) : initials}
      </div>

      {/* Tooltip — portaled to document.body to escape all overflow */}
      {isHovered && tooltipPos && createPortal(
        <div
          style={{
            position: 'fixed',
            left: tooltipPos.left,
            top: tooltipPos.top,
            width: 240,
            transform: 'translateY(-100%)',
            zIndex: 9999,
            pointerEvents: 'none',
          }}
        >
          <div className="bg-[#1e1e22] border border-white/10 rounded-lg shadow-2xl p-3">
            <div className="flex items-center gap-2 mb-1.5">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold leading-none text-white shrink-0"
                style={{ backgroundColor: color }}
              >
                {initials}
              </div>
              <span className="min-w-0 flex-1 text-xs font-medium text-white truncate">{authorName}</span>
              <div className="flex items-center gap-1.5 shrink-0 text-text-tertiary">
                {commentNumber !== undefined && (
                  <span className="text-[10px] font-semibold">#{commentNumber}</span>
                )}
                {comment.visibility === 'internal' ? (
                  <Lock className="h-3.5 w-3.5 text-amber-400" />
                ) : (
                  <Globe className="h-3.5 w-3.5" />
                )}
              </div>
            </div>
            <div className="flex items-start gap-2">
              {comment.timecode_start !== null && (
                <span className="shrink-0 text-[10px] font-mono text-amber-400 bg-amber-500/20 px-1.5 py-0.5 rounded">
                  {formatTimecode(comment.timecode_start)}
                  {comment.timecode_end !== null && ` — ${formatTimecode(comment.timecode_end)}`}
                </span>
              )}
              <p className="min-w-0 text-xs text-text-secondary line-clamp-2 leading-relaxed">
                {comment.body}
              </p>
            </div>
          </div>
          {/* Arrow */}
          <div className="flex justify-center">
            <div className="w-2 h-2 bg-[#1e1e22] border-b border-r border-white/10 rotate-45 -mt-1" />
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProgressBar({
  currentTime,
  duration,
  buffered = 0,
  comments = [],
  streamUrl,
  onSeek,
  className,
}: ProgressBarProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [rangeDragStart, setRangeDragStart] = useState<number | null>(null)
  const [rangeDragEnd, setRangeDragEnd] = useState<number | null>(null)
  const [draggingRangeHandle, setDraggingRangeHandle] = useState<'start' | 'end' | null>(null)
  const [hoverTime, setHoverTime] = useState<number | null>(null)
  const [hoverX, setHoverX] = useState(0)
  const [hoveredCommentId, setHoveredCommentId] = useState<string | null>(null)
  const focusedCommentId = useReviewStore((s) => s.focusedCommentId)
  const selectedTimeRange = useReviewStore((s) => s.selectedTimeRange)
  const setSelectedTimeRange = useReviewStore((s) => s.setSelectedTimeRange)

  const { previewImage, seekPreview, clearPreview } = useFramePreview(streamUrl)

  const timeToPercent = useCallback(
    (time: number): number => {
      if (!duration) return 0
      return Math.max(0, Math.min(100, (time / duration) * 100))
    },
    [duration],
  )

  const getTimeFromEvent = useCallback(
    (clientX: number): number => {
      const track = trackRef.current
      if (!track || !duration) return 0
      const rect = track.getBoundingClientRect()
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
      return ratio * duration
    },
    [duration],
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const time = getTimeFromEvent(e.clientX)
      setHoverTime(time)
      const track = trackRef.current
      if (track) {
        const rect = track.getBoundingClientRect()
        setHoverX(e.clientX - rect.left)
      }
      if (isDragging) {
        onSeek(time)
      }
      seekPreview(time)
    },
    [isDragging, getTimeFromEvent, onSeek, seekPreview],
  )

  const handleMouseLeave = useCallback(() => {
    if (!isDragging && !draggingRangeHandle) {
      setHoverTime(null)
      clearPreview()
    }
  }, [isDragging, draggingRangeHandle, clearPreview])

  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault()
      const time = getTimeFromEvent(e.clientX)
      if (e.shiftKey) {
        setRangeDragStart(time)
        setRangeDragEnd(time)
        return
      }
      setIsDragging(true)
      onSeek(time)
    },
    [getTimeFromEvent, onSeek],
  )

  // Global mouse up / move to handle drag outside track
  useEffect(() => {
    if (!isDragging && rangeDragStart === null && !draggingRangeHandle) return

    const handleGlobalMouseMove = (e: MouseEvent) => {
      const time = getTimeFromEvent(e.clientX)
      if (rangeDragStart !== null) setRangeDragEnd(time)
      else if (draggingRangeHandle && selectedTimeRange) {
        setSelectedTimeRange(
          draggingRangeHandle === 'start'
            ? { start: Math.min(time, selectedTimeRange.end), end: selectedTimeRange.end }
            : { start: selectedTimeRange.start, end: Math.max(time, selectedTimeRange.start) },
        )
      }
      else onSeek(time)
    }

    const handleGlobalMouseUp = (e: MouseEvent) => {
      const time = getTimeFromEvent(e.clientX)
      if (rangeDragStart !== null) {
        const start = Math.min(rangeDragStart, time)
        const end = Math.max(rangeDragStart, time)
        setSelectedTimeRange(end - start > 0.05 ? { start, end } : null)
        setRangeDragStart(null)
        setRangeDragEnd(null)
      }
      setDraggingRangeHandle(null)
      setIsDragging(false)
      setHoverTime(null)
      clearPreview()
      if (rangeDragStart === null && !draggingRangeHandle) onSeek(time)
    }

    window.addEventListener('mousemove', handleGlobalMouseMove)
    window.addEventListener('mouseup', handleGlobalMouseUp)
    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove)
      window.removeEventListener('mouseup', handleGlobalMouseUp)
    }
  }, [isDragging, rangeDragStart, draggingRangeHandle, selectedTimeRange, getTimeFromEvent, onSeek, clearPreview, setSelectedTimeRange])

  // Separate timecoded comments
  // Same helper the side panel uses, so a marker's #N always matches its card's.
  const commentNumbers = React.useMemo(() => buildCommentNumbers(comments), [comments])

  const pointMarkers = comments.filter(
    (c) => c.timecode_start !== null && c.timecode_end === null && !c.resolved,
  )
  const rangeMarkers = comments.filter(
    (c) => c.timecode_start !== null && c.timecode_end !== null && !c.resolved,
  )

  const playPercent = timeToPercent(currentTime)
  const bufferedPercent = timeToPercent(buffered)
  const activeRange = rangeDragStart !== null && rangeDragEnd !== null
    ? { start: Math.min(rangeDragStart, rangeDragEnd), end: Math.max(rangeDragStart, rangeDragEnd) }
    : selectedTimeRange
  const hasAreaRange = !!activeRange && activeRange.end - activeRange.start > 0.05
  const rangeHandleTimes = activeRange
    ? hasAreaRange
      ? [activeRange.start, activeRange.end]
      : [activeRange.start]
    : []

  return (
    <div className={cn('relative flex flex-col w-full group/progress py-1', className)}>
      {/* Track area */}
      <div
        ref={trackRef}
        className="relative w-full h-1 group-hover/progress:h-1.5 transition-all duration-150 cursor-pointer bg-border rounded-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onMouseDown={handleMouseDown}
        title="Shift + drag to select a comment range"
      >
        {/* Buffered range */}
        <div
          className="absolute inset-y-0 left-0 bg-border-secondary rounded-full"
          style={{ width: `${bufferedPercent}%` }}
        />

        {/* Time-range comment spans */}
        {rangeMarkers.map((c) => {
          if (c.timecode_start === null || c.timecode_end === null) return null
          const left = timeToPercent(c.timecode_start)
          const right = timeToPercent(c.timecode_end)
          return (
            <div
              key={c.id}
              className={cn(
                'absolute inset-y-0 rounded-full pointer-events-none',
                focusedCommentId === c.id ? 'bg-white/35' : 'bg-white/20',
              )}
              style={{
                left: `${left}%`,
                width: `${right - left}%`,
              }}
            />
          )
        })}

        {/* Pending/selected range for the next comment */}
        {activeRange && hasAreaRange && (
          <>
            <div
              className="absolute inset-y-0 rounded-sm bg-amber-400/45 pointer-events-none z-[1]"
              style={{
                left: `${timeToPercent(activeRange.start)}%`,
                width: `${Math.max(0.4, timeToPercent(activeRange.end) - timeToPercent(activeRange.start))}%`,
              }}
            />
          </>
        )}

        {/* Playback progress */}
        <div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            width: `${playPercent}%`,
            background: 'var(--accent)',
          }}
        />

        {/* Playhead thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-accent shadow-lg opacity-0 group-hover/progress:opacity-100 transition-opacity pointer-events-none z-10"
          style={{ left: `${playPercent}%`, transform: 'translateX(-50%) translateY(-50%)' }}
        />
      </div>

      {/* Comment markers row — below the progress bar */}
      {(pointMarkers.length > 0 || rangeMarkers.length > 0 || activeRange) && (
        <div className="relative w-full h-6 mt-0.5">
          {activeRange && <>
            {rangeHandleTimes.map((time, index) => (
              <button
                type="button"
                key={`range-handle-${index}`}
                disabled={!selectedTimeRange}
                className={cn(
                  'absolute top-0 z-[2] h-5 cursor-ew-resize disabled:cursor-default',
                  hasAreaRange ? 'w-3' : 'w-4',
                )}
                style={{
                  left: `${timeToPercent(time)}%`,
                  transform: 'translateX(-50%)',
                }}
                onMouseDown={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  if (selectedTimeRange) {
                    setDraggingRangeHandle(hasAreaRange && index === 0 ? 'start' : 'end')
                  }
                }}
                aria-label={hasAreaRange && index === 0 ? 'Adjust range start' : 'Adjust range end'}
              >
                {hasAreaRange ? <>
                  <span className="absolute inset-y-0 left-1/2 w-[3px] -translate-x-1/2 rounded-sm bg-white shadow-sm" />
                  <span
                    className={cn(
                      "absolute top-0 h-1.5 w-1.5 border-t-2 border-amber-400",
                      index === 0 ? "left-0 border-l-2" : "right-0 border-r-2",
                    )}
                  />
                  <span
                    className={cn(
                      "absolute bottom-0 h-1.5 w-1.5 border-b-2 border-amber-400",
                      index === 0 ? "left-0 border-l-2" : "right-0 border-r-2",
                    )}
                  />
                </> : <>
                  <span className="absolute inset-y-0 left-1 w-[3px] rounded-sm bg-white shadow-sm" />
                  <span className="absolute inset-y-0 right-1 w-[3px] rounded-sm bg-white shadow-sm" />
                  <span className="absolute left-0 top-0 h-1.5 w-1.5 border-l-2 border-t-2 border-amber-400" />
                  <span className="absolute bottom-0 left-0 h-1.5 w-1.5 border-b-2 border-l-2 border-amber-400" />
                  <span className="absolute right-0 top-0 h-1.5 w-1.5 border-r-2 border-t-2 border-amber-400" />
                  <span className="absolute bottom-0 right-0 h-1.5 w-1.5 border-b-2 border-r-2 border-amber-400" />
                </>}
              </button>
            ))}
            {selectedTimeRange && (
              <button
                type="button"
                className="absolute top-0.5 z-[2] flex h-4 w-4 items-center justify-center rounded-full bg-text-tertiary text-bg-primary hover:bg-text-secondary"
                style={{ left: `${timeToPercent(selectedTimeRange.end)}%`, transform: 'translateX(10px)' }}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={() => setSelectedTimeRange(null)}
                aria-label="Clear selected range"
                title="Clear selected range"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
              </button>
            )}
          </>}
          {rangeMarkers.map((c) => {
            if (c.timecode_start === null || c.timecode_end === null) return null
            const left = timeToPercent(c.timecode_start)
            const right = timeToPercent(c.timecode_end)
            const authorName = c.author?.name ?? c.guest_author?.name ?? 'Unknown'
            const initials = getInitials(authorName)
            const color = getAvatarColor(authorName)
            const isHovered = hoveredCommentId === c.id

            return (
              <CommentMarker
                key={c.id}
                comment={c}
                commentNumber={commentNumbers.get(c.id)}
                leftPercent={left}
                rightPercent={right}
                authorName={authorName}
                initials={initials}
                color={color}
                isHovered={isHovered}
                isFocused={focusedCommentId === c.id}
                onHover={() => setHoveredCommentId(c.id)}
                onLeave={() => setHoveredCommentId(null)}
                onSeek={onSeek}
              />
            )
          })}
          {pointMarkers.map((c) => {
            if (c.timecode_start === null) return null
            const left = timeToPercent(c.timecode_start)
            const authorName = c.author?.name ?? c.guest_author?.name ?? 'Unknown'
            const initials = getInitials(authorName)
            const color = getAvatarColor(authorName)
            const isHovered = hoveredCommentId === c.id

            return (
              <CommentMarker
                key={c.id}
                comment={c}
                commentNumber={commentNumbers.get(c.id)}
                leftPercent={left}
                authorName={authorName}
                initials={initials}
                color={color}
                isHovered={isHovered}
                isFocused={focusedCommentId === c.id}
                onHover={() => setHoveredCommentId(c.id)}
                onLeave={() => setHoveredCommentId(null)}
                onSeek={onSeek}
              />
            )
          })}
        </div>
      )}

      {/* Frame preview + time tooltip on bar hover */}
      {hoverTime !== null && (
        <div
          className="absolute -top-2 z-30 pointer-events-none"
          style={{ left: hoverX, transform: 'translateX(-50%) translateY(-100%)' }}
        >
          {/* Frame preview */}
          {previewImage && (
            <div className="mb-1 rounded-md overflow-hidden border border-white/15 shadow-2xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewImage} alt="" className="w-40 object-contain bg-black" />
            </div>
          )}
          {/* Time label */}
          <div className="flex justify-center">
            <span className="bg-black/90 text-white text-[11px] font-mono px-2 py-0.5 rounded-md">
              {formatTimecode(hoverTime)}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
