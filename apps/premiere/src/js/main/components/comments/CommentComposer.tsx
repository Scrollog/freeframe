import { useRef } from "react";
import { imageFromClipboard } from "../../../lib/freeframe/comment-attachments";
import { formatTimecode } from "../../../lib/freeframe/timecode";
import { AutoTextarea } from "../AutoTextarea";
import { Dropdown, MenuRadio } from "../Dropdown";
import { EmojiPicker } from "../EmojiPicker";
import {
  IconAttachment,
  IconChevronDown,
  IconClock,
  IconClose,
  IconGlobe,
  IconSend,
} from "../Icons";

interface CommentComposerProps {
  draft: string;
  attachment: File | null;
  busy: boolean;
  fps?: number;
  hasTimecode: boolean;
  timecodeAttached: boolean;
  composerTime: number;
  selectedTimeRange: { start: number; end: number } | null;
  visibility: "public" | "internal";
  onDraftChange: (value: string) => void;
  onAttachmentChange: (file: File | null) => void;
  onTimecodeAttachedChange: (attached: boolean) => void;
  onSelectedTimeRangeChange: (range: { start: number; end: number } | null) => void;
  onVisibilityChange: (visibility: "public" | "internal") => void;
  onPost: () => void;
}

/** Presentation-only composer; the parent keeps comment creation and API state. */
export const CommentComposer = ({
  draft,
  attachment,
  busy,
  fps,
  hasTimecode,
  timecodeAttached,
  composerTime,
  selectedTimeRange,
  visibility,
  onDraftChange,
  onAttachmentChange,
  onTimecodeAttachedChange,
  onSelectedTimeRangeChange,
  onVisibilityChange,
  onPost,
}: CommentComposerProps) => {
  const attachmentInputRef = useRef<HTMLInputElement>(null);
  const displayTime = selectedTimeRange?.start ?? composerTime;
  const hasRange = Boolean(
    selectedTimeRange && selectedTimeRange.end - selectedTimeRange.start > 0.05
  );

  return (
    <div className="composer">
      <div className="composer-input">
        {timecodeAttached && (
          <span className="tc composer-tc">
            {formatTimecode(displayTime, fps)}
            {hasRange && <> – {formatTimecode(selectedTimeRange!.end, fps)}</>}
            {selectedTimeRange && (
              <button className="range-clear" onClick={() => onSelectedTimeRangeChange(null)} title="Clear selected range">
                <IconClose width={10} height={10} />
              </button>
            )}
          </span>
        )}
        <AutoTextarea
          value={draft}
          onChange={(event) => {
            const value = event.target.value;
            onDraftChange(value);
            if (value.trim() && hasTimecode && timecodeAttached && !selectedTimeRange) {
              onSelectedTimeRangeChange({ start: composerTime, end: composerTime });
            }
          }}
          onPaste={(event) => {
            const image = imageFromClipboard(event.clipboardData?.items);
            if (!image) return;

            event.preventDefault();
            onAttachmentChange(image);
          }}
          placeholder="Leave your comment…"
        />
      </div>
      {attachment && (
        <div className="pending-attachment">
          <IconAttachment width={13} height={13} />
          <span>{attachment.name}</span>
          <button title="Remove attachment" onClick={() => onAttachmentChange(null)}>
            <IconClose width={11} height={11} />
          </button>
        </div>
      )}
      <div className="composer-actions">
        <input
          ref={attachmentInputRef}
          className="attachment-input"
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0] ?? null;
            event.target.value = "";
            onAttachmentChange(file);
          }}
        />
        <button className="icon-btn" title="Attach file" onClick={() => attachmentInputRef.current?.click()}>
          <IconAttachment width={14} height={14} />
        </button>
        <EmojiPicker onPick={(emoji) => onDraftChange(draft + emoji)} />
        {hasTimecode && (
          <button
            className={`icon-btn timecode-toggle${timecodeAttached ? " on" : ""}`}
            onClick={() => {
              if (timecodeAttached) onSelectedTimeRangeChange(null);
              onTimecodeAttachedChange(!timecodeAttached);
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
          trigger={<><IconGlobe width={13} height={13} />{visibility === "internal" ? "Internal" : "Public"}<IconChevronDown width={12} height={12} /></>}
        >
          {(close) => (
            <>
              <MenuRadio label="Public — everyone on the asset" checked={visibility === "public"} onSelect={() => { onVisibilityChange("public"); close(); }} />
              <MenuRadio label="Internal — team only" checked={visibility === "internal"} onSelect={() => { onVisibilityChange("internal"); close(); }} />
            </>
          )}
        </Dropdown>
        <button className="primary" onClick={onPost} disabled={busy || !draft.trim()} title="Post">
          <IconSend width={14} height={14} />
        </button>
      </div>
    </div>
  );
};
