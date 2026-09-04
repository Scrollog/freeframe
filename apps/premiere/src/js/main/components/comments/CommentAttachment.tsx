import type { CommentAttachment as CommentAttachmentData } from "../../../lib/freeframe/types";
import { openLinkInBrowser } from "../../../lib/utils/bolt";
import { IconAttachment, IconClose, IconDownload } from "../Icons";

interface CommentAttachmentProps {
  attachment: CommentAttachmentData;
  canDelete: boolean;
  onDelete?: () => void;
}

const formatSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.ceil(bytes / 1024))} KB`;

/** Compact image/file preview used by both root comments and replies. */
export const CommentAttachment = ({ attachment, canDelete, onDelete }: CommentAttachmentProps) => {
  const image = attachment.content_type.startsWith("image/");

  return (
    <div className={`comment-attachment${image ? " image" : ""}`}>
      {image ? (
        <button className="comment-attachment-preview" onClick={() => openLinkInBrowser(attachment.url)}>
          <img src={attachment.url} alt={attachment.file_name} />
        </button>
      ) : (
        <button className="comment-attachment-file" onClick={() => openLinkInBrowser(attachment.url)}>
          <IconAttachment width={14} height={14} />
          <span>
            <strong>{attachment.file_name}</strong>
            <em>{formatSize(attachment.file_size)}</em>
          </span>
          <IconDownload width={13} height={13} />
        </button>
      )}
      {canDelete && onDelete && (
        <button className="comment-attachment-remove" title="Remove attachment" onClick={onDelete}>
          <IconClose width={11} height={11} />
        </button>
      )}
    </div>
  );
};
