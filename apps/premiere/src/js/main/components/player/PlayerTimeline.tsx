import type { RefObject } from "react";
import type { Comment } from "../../../lib/freeframe/types";
import { formatTimecode } from "../../../lib/freeframe/timecode";
import { IconClose } from "../Icons";

interface PlayerTimelineProps {
  duration: number;
  time: number;
  dragging: boolean;
  timedComments: Comment[];
  commentNumbers: Map<string, number>;
  fps?: number;
  selectedTimeRange?: { start: number; end: number } | null;
  preview: { x: number; time: number } | null;
  previewReady: boolean;
  hoveredCommentId: string | null;
  scrubRef: RefObject<HTMLDivElement | null>;
  previewRef: RefObject<HTMLVideoElement | null>;
  onScrubDown: (event: React.MouseEvent<HTMLDivElement>) => void;
  onShowPreview: (clientX: number) => void;
  onHidePreview: () => void;
  onRangeHandleDown: (
    event: React.MouseEvent<HTMLButtonElement>,
    handle: "start" | "end"
  ) => void;
  onClearRange: () => void;
  onSelectComment?: (comment: Comment) => void;
  onHoverComment: (commentId: string | null) => void;
  onPreviewMediaReady: () => void;
}

const authorNameOf = (comment: Comment) =>
  comment.author?.name ?? comment.guest_author?.name ?? "Guest";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

/**
 * Timeline presentation for review playback. Scrub math and preview-stream
 * ownership stay in Player; this component renders their current state.
 */
export const PlayerTimeline = ({
  duration,
  time,
  dragging,
  timedComments,
  commentNumbers,
  fps,
  selectedTimeRange,
  preview,
  previewReady,
  hoveredCommentId,
  scrubRef,
  previewRef,
  onScrubDown,
  onShowPreview,
  onHidePreview,
  onRangeHandleDown,
  onClearRange,
  onSelectComment,
  onHoverComment,
  onPreviewMediaReady,
}: PlayerTimelineProps) => {
  const progress = duration ? (time / duration) * 100 : 0;

  return (
    <>
      <div
        className={`scrub${dragging ? " dragging" : ""}`}
        ref={scrubRef}
        onMouseDown={onScrubDown}
        onMouseMove={(event) => onShowPreview(event.clientX)}
        onMouseLeave={onHidePreview}
      >
        <div className="scrub-track">
          <div className="scrub-fill" style={{ width: `${progress}%` }} />
        </div>
        {duration > 0 &&
          timedComments.map((comment) => {
            const start = comment.timecode_start as number;
            const end = comment.timecode_end;
            const hasRange = end !== null && end !== undefined && end > start;
            if (!hasRange) return null;
            const left = (start / duration) * 100;
            const right = Math.min(100, ((end as number) / duration) * 100);
            return (
              <button
                key={comment.id}
                className={`comment-range${comment.resolved ? " done" : ""}`}
                style={{ left: `${left}%`, width: `${Math.max(0, right - left)}%` }}
                title={`${formatTimecode(start, fps)} – ${formatTimecode(end, fps)} — ${comment.body}`}
                onMouseDown={(event) => event.stopPropagation()}
                onClick={(event) => {
                  event.stopPropagation();
                  onSelectComment?.(comment);
                }}
              />
            );
          })}
        {selectedTimeRange && selectedTimeRange.end - selectedTimeRange.start > 0.05 && (
          <span
            className="selected-comment-range"
            style={{
              left: `${(selectedTimeRange.start / duration) * 100}%`,
              width: `${((selectedTimeRange.end - selectedTimeRange.start) / duration) * 100}%`,
            }}
          />
        )}
        <div className="playhead" style={{ left: `${progress}%` }}>
          <span className="knob" />
        </div>

        <div
          className={`scrub-preview${preview && duration > 0 ? " on" : ""}`}
          // Keep this video mounted between hovers. Recreating its element
          // while reusing the HLS controller was what caused the black frame.
          style={{
            left: `${Math.min(
              Math.max(preview?.x ?? 84, 84),
              Math.max(84, (scrubRef.current?.clientWidth ?? 0) - 84)
            )}px`,
          }}
        >
          <video
            ref={previewRef}
            className={previewReady ? "ready" : ""}
            muted
            playsInline
            preload="auto"
            onLoadedMetadata={onPreviewMediaReady}
            onCanPlay={onPreviewMediaReady}
          />
          <span>{formatTimecode(preview?.time ?? 0, fps)}</span>
        </div>
      </div>

      {duration > 0 && (timedComments.length > 0 || selectedTimeRange) && (
        <div className="comment-marker-rail">
          {selectedTimeRange && (
            <>
              {(selectedTimeRange.end - selectedTimeRange.start > 0.05
                ? [selectedTimeRange.start, selectedTimeRange.end]
                : [selectedTimeRange.start]
              ).map((rangeTime, index, handles) => {
                const hasArea = handles.length === 2;
                const handle = hasArea && index === 0 ? "start" : "end";
                return (
                  <button
                    key={`${handle}-${rangeTime}`}
                    className={`range-handle${hasArea ? ` ${handle}` : " point"}`}
                    style={{ left: `${(rangeTime / duration) * 100}%` }}
                    onMouseDown={(event) => onRangeHandleDown(event, handle)}
                    title={handle === "start" ? "Adjust range start" : "Adjust range end"}
                  />
                );
              })}
              <button
                className={`range-handle-clear${
                  selectedTimeRange.end / duration > 0.9 ? " edge" : ""
                }`}
                style={{ left: `${(selectedTimeRange.end / duration) * 100}%` }}
                onClick={onClearRange}
                title="Clear selected range"
              >
                <IconClose width={10} height={10} />
              </button>
            </>
          )}
          {timedComments.map((comment) => {
            const start = comment.timecode_start as number;
            const end = comment.timecode_end;
            const hasRange = end !== null && end !== undefined && end > start;
            const left = (start / duration) * 100;
            const authorName = authorNameOf(comment);
            const commentNumber = commentNumbers.get(comment.id);
            const tooltipEdge = left < 22 ? " start" : left > 78 ? " end" : "";
            return (
              <span key={comment.id} className="comment-marker">
                {hasRange && (
                  <span
                    className="comment-range-line"
                    style={{ left: `${left}%`, width: `${((end - start) / duration) * 100}%` }}
                  />
                )}
                <button
                  className={`pip${comment.resolved ? " done" : ""}`}
                  style={{ left: `${left}%` }}
                  title={`${formatTimecode(start, fps)} — ${comment.body}`}
                  onClick={() => onSelectComment?.(comment)}
                  onMouseEnter={() => onHoverComment(comment.id)}
                  onMouseLeave={() => onHoverComment(null)}
                >
                  {comment.author?.avatar_url ? (
                    <img src={comment.author.avatar_url} alt="" />
                  ) : (
                    initialsOf(authorName)
                  )}
                </button>
                {hoveredCommentId === comment.id && (
                  <span className={`comment-tooltip${tooltipEdge}`} style={{ left: `${left}%` }}>
                    <span className="comment-tooltip-head">
                      <span className="marker-avatar">
                        {comment.author?.avatar_url ? (
                          <img src={comment.author.avatar_url} alt="" />
                        ) : (
                          initialsOf(authorName)
                        )}
                      </span>
                      <strong>{authorName}</strong>
                      {commentNumber !== undefined && (
                        <span className="comment-tooltip-index">#{commentNumber}</span>
                      )}
                    </span>
                    <span className="comment-tooltip-body">
                      <em>
                        {formatTimecode(start, fps)}
                        {hasRange ? ` – ${formatTimecode(end, fps)}` : ""}
                      </em>
                      {comment.body}
                    </span>
                  </span>
                )}
              </span>
            );
          })}
        </div>
      )}
    </>
  );
};
