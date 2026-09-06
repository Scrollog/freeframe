import { useRef } from "react";
import { imageFromClipboard } from "../../../lib/freeframe/comment-attachments";
import { relativeTime } from "../../../lib/freeframe/format";
import { formatTimecode } from "../../../lib/freeframe/timecode";
import type { Comment, Me } from "../../../lib/freeframe/types";
import { CommentAttachment } from "./CommentAttachment";
import { EmojiPicker } from "../EmojiPicker";
import {
  IconAnnotation,
  IconCheck,
  IconEmoji,
  IconExternal,
  IconReply,
  IconTrash,
} from "../Icons";

const authorOf = (comment: Comment) =>
  comment.author?.name ?? comment.guest_author?.name ?? "Guest";

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

interface ReplyTreeProps {
  reply: Comment;
  user: Me | null;
  onDeleteAttachment: (commentId: string, attachmentId: string) => void;
}

/** Renders every reply level returned by the API, not only direct children. */
const ReplyTree = ({ reply, user, onDeleteAttachment }: ReplyTreeProps) => {
  const author = authorOf(reply);
  const canDeleteAttachment = Boolean(user && (user.is_superadmin || reply.author?.id === user.id));

  return (
    <>
      <div className="reply">
        <span className="avatar">
          {reply.author?.avatar_url ? <img src={reply.author.avatar_url} alt="" /> : initialsOf(author)}
        </span>
        <div className="reply-content">
          <p>
            <strong>{author}</strong> {reply.body}
          </p>
          {!!reply.attachments?.length && (
            <div className="comment-attachments">
              {reply.attachments.map((attachment) => (
                <CommentAttachment
                  key={attachment.id}
                  attachment={attachment}
                  canDelete={canDeleteAttachment}
                  onDelete={() => onDeleteAttachment(reply.id, attachment.id)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      {reply.replies?.map((child) => (
        <ReplyTree key={child.id} reply={child} user={user} onDeleteAttachment={onDeleteAttachment} />
      ))}
    </>
  );
};

interface InlineReplyComposerProps {
  draft: string;
  attachment: File | null;
  onDraftChange: (value: string) => void;
  onAttachmentChange: (file: File | null) => void;
  onSubmit: () => void;
}

const InlineReplyComposer = ({
  draft,
  attachment,
  onDraftChange,
  onAttachmentChange,
  onSubmit,
}: InlineReplyComposerProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="reply-box" onClick={(event) => event.stopPropagation()}>
      <input
        ref={inputRef}
        className="attachment-input"
        type="file"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          event.target.value = "";
          onAttachmentChange(file);
        }}
      />
      <input
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onPaste={(event) => {
          const image = imageFromClipboard(event.clipboardData?.items);
          if (!image) return;
          event.preventDefault();
          onAttachmentChange(image);
        }}
        placeholder="Reply…"
        autoFocus
      />
      <button className="icon-btn" onClick={() => inputRef.current?.click()} title="Attach file">
        <IconReply width={13} height={13} />
      </button>
      {attachment && (
        <button className="text-btn" onClick={() => onAttachmentChange(null)} title="Remove attachment">
          {attachment.name}
        </button>
      )}
      <EmojiPicker onPick={(emoji) => onDraftChange(draft + emoji)} />
      <button className="primary" onClick={onSubmit}>Send</button>
    </div>
  );
};

interface CommentItemProps {
  comment: Comment;
  active: boolean;
  isRead: boolean;
  user: Me | null;
  index?: number;
  justRead: boolean;
  onToggleDone: () => void;
  fps?: number;
  onDeleteAttachment: (attachmentId: string) => void;
  onDeleteReplyAttachment: (commentId: string, attachmentId: string) => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onOpen: () => void;
  onDelete: () => void;
  replyTo: string | null;
  replyDraft: string;
  replyAttachment: File | null;
  onReplyDraftChange: (value: string) => void;
  onReplyAttachmentChange: (file: File | null) => void;
  onReplySubmit: () => void;
  onSelect: () => void;
}

export const CommentItem = ({
  comment,
  active,
  isRead,
  user,
  index,
  justRead,
  onToggleDone,
  fps,
  onDeleteAttachment,
  onDeleteReplyAttachment,
  onReact,
  onReply,
  onOpen,
  onDelete,
  replyTo,
  replyDraft,
  replyAttachment,
  onReplyDraftChange,
  onReplyAttachmentChange,
  onReplySubmit,
  onSelect,
}: CommentItemProps) => {
  const author = authorOf(comment);
  const canDeleteAttachment = Boolean(user && (user.is_superadmin || comment.author?.id === user.id));

  return (
    <li
      data-comment={comment.id}
      className={`comment${active ? " active" : ""}${comment.resolved ? " resolved" : ""}${
        comment.replies?.length ? " has-replies" : ""
      }`}
      onClick={onSelect}
    >
      {user && comment.author?.id !== user.id && !isRead && <span className="unread-dot" />}
      <div className="comment-head">
        <span className="avatar">
          {comment.author?.avatar_url ? <img src={comment.author.avatar_url} alt="" /> : initialsOf(author)}
        </span>
        <span className="author">{author}</span>
        {comment.annotation && <span className="has-annotation" title="Has an annotation"><IconAnnotation width={12} height={12} /></span>}
        <span className="when">{justRead ? "Read by you" : relativeTime(comment.created_at)}</span>
        <span className="index">#{index}</span>
        <button className={`done-box${comment.resolved ? " on" : ""}`} title="Mark as complete" onClick={(event) => { event.stopPropagation(); onToggleDone(); }}><IconCheck width={11} height={11} /></button>
      </div>
      <p className="body">
        {comment.timecode_start !== null && (
          <span className="tc">
            {formatTimecode(comment.timecode_start, fps)}
            {comment.timecode_end !== null && comment.timecode_end !== undefined && comment.timecode_end - comment.timecode_start > 0.05 && <> – {formatTimecode(comment.timecode_end, fps)}</>}
          </span>
        )}
        {comment.body}
      </p>
      {!!comment.attachments?.length && (
        <div className="comment-attachments" onClick={(event) => event.stopPropagation()}>
          {comment.attachments.map((attachment) => (
            <CommentAttachment key={attachment.id} attachment={attachment} canDelete={canDeleteAttachment} onDelete={() => onDeleteAttachment(attachment.id)} />
          ))}
        </div>
      )}
      {!!comment.replies?.length && (
        <div className="replies">
          {comment.replies.map((reply) => (
            <ReplyTree key={reply.id} reply={reply} user={user} onDeleteAttachment={onDeleteReplyAttachment} />
          ))}
        </div>
      )}
      {!!comment.reactions?.length && (
        <div className="reactions" onClick={(event) => event.stopPropagation()}>
          {comment.reactions.map((reaction) => (
            <button key={reaction.emoji} className={`reaction${reaction.reacted ? " on" : ""}`} onClick={() => onReact(reaction.emoji)}><span>{reaction.emoji}</span>{reaction.count}</button>
          ))}
        </div>
      )}
      <div className="comment-actions" onClick={(event) => event.stopPropagation()}>
        <EmojiPicker title="React" trigger={<IconEmoji width={13} height={13} />} onPick={onReact} />
        <button className="text-btn" onClick={onReply}><IconReply width={12} height={12} />Reply</button>
        <button className="text-btn" onClick={onOpen}><IconExternal width={12} height={12} />Open</button>
        {user && (user.is_superadmin || comment.author?.id === user.id) && <button className="text-btn danger" onClick={onDelete}><IconTrash width={12} height={12} />Delete</button>}
      </div>
      {replyTo === comment.id && <InlineReplyComposer draft={replyDraft} attachment={replyAttachment} onDraftChange={onReplyDraftChange} onAttachmentChange={onReplyAttachmentChange} onSubmit={onReplySubmit} />}
    </li>
  );
};
