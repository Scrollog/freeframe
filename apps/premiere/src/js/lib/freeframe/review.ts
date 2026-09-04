/** Pure Review-domain rules. Keep these independent of React and CEP so that
 * filtering, marker selection and timestamp navigation remain deterministic. */
import type { Comment } from "./types";
import type { AssetLink, SegmentLink } from "./host";

export type ReviewSortKey = "timecode" | "oldest" | "newest" | "commenter" | "completed";

export interface ReviewFilters {
  annotations: boolean;
  attachments: boolean;
  completed: boolean;
  incomplete: boolean;
  person: string;
}

export const EMPTY_REVIEW_FILTERS: ReviewFilters = {
  annotations: false,
  attachments: false,
  completed: false,
  incomplete: false,
  person: "",
};

export const commentAuthorName = (comment: Comment) =>
  comment.author?.name || comment.guest_author?.name || "Guest";

/** Adds a reply beneath its parent without flattening the API's comment tree. */
export const insertReplyIntoThread = (
  comments: Comment[],
  parentId: string,
  reply: Comment
): Comment[] =>
  comments.map((comment) => {
    if (comment.id === parentId) {
      const replies = comment.replies ?? [];
      return replies.some((item) => item.id === reply.id)
        ? comment
        : { ...comment, replies: [...replies, reply] };
    }

    if (!comment.replies?.length) return comment;
    return {
      ...comment,
      replies: insertReplyIntoThread(comment.replies, parentId, reply),
    };
  });

export const commentTreeContains = (comments: Comment[], commentId: string): boolean =>
  comments.some(
    (comment) =>
      comment.id === commentId || commentTreeContains(comment.replies ?? [], commentId)
  );

export const timestampedComments = (comments: Comment[]) =>
  comments
    .filter((comment) => comment.timecode_start !== null && comment.timecode_start !== undefined)
    .sort((a, b) => (a.timecode_start as number) - (b.timecode_start as number));

export const filterAndSortComments = ({
  comments,
  filters,
  query,
  sort,
  hideResolved,
}: {
  comments: Comment[];
  filters: ReviewFilters;
  query: string;
  sort: ReviewSortKey;
  hideResolved: boolean;
}) => {
  const needle = query.trim().toLowerCase();
  const filtered = comments.filter((comment) => {
    if (hideResolved && comment.resolved) return false;
    if (filters.completed && !comment.resolved) return false;
    if (filters.incomplete && comment.resolved) return false;
    if (filters.annotations && !comment.annotation) return false;
    if (filters.attachments && !comment.attachments?.length) return false;
    if (filters.person && commentAuthorName(comment) !== filters.person) return false;
    if (!needle) return true;
    const haystack = `${comment.body} ${commentAuthorName(comment)} ${comment.replies
      ?.map((reply) => reply.body)
      .join(" ")}`.toLowerCase();
    return haystack.includes(needle);
  });

  const timecodeOf = (comment: Comment) =>
    comment.timecode_start === null || comment.timecode_start === undefined
      ? Number.MAX_SAFE_INTEGER
      : comment.timecode_start;

  return filtered.sort((a, b) => {
    switch (sort) {
      case "timecode":
        return timecodeOf(a) - timecodeOf(b) || a.created_at.localeCompare(b.created_at);
      case "newest":
        return b.created_at.localeCompare(a.created_at);
      case "commenter":
        return (
          commentAuthorName(a).localeCompare(commentAuthorName(b)) ||
          a.created_at.localeCompare(b.created_at)
        );
      case "completed":
        return Number(b.resolved) - Number(a.resolved) || a.created_at.localeCompare(b.created_at);
      default:
        return a.created_at.localeCompare(b.created_at);
    }
  });
};

export const markerSignatureFor = (comments: Comment[]) =>
  comments.map((comment) => `${comment.id}:${comment.resolved ? 1 : 0}:${comment.timecode_start ?? ""}`).join("|");

/** Segment links have the real In point and take precedence over a direct link. */
export const resolveSequenceLink = ({
  assetId,
  versionId,
  link,
  segmentLinks,
}: {
  assetId: string;
  versionId: string;
  link: AssetLink | null;
  segmentLinks: SegmentLink[];
}) => {
  const sequenceLink = link?.assetId === assetId ? link : null;
  const segmentLink =
    segmentLinks.find((entry) => entry.assetId === assetId && entry.versionId === versionId) ??
    segmentLinks.find((entry) => entry.assetId === assetId) ??
    null;
  return {
    sequenceLink,
    segmentLink,
    isLinked: Boolean(sequenceLink || segmentLink),
    offsetSeconds: segmentLink?.inPoint ?? sequenceLink?.offsetSeconds ?? 0,
  };
};
