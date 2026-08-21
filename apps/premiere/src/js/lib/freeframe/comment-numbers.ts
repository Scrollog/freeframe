import type { Comment } from "./types";

/**
 * Stable display numbers shared by the review list, timeline and Premiere
 * markers. Replies deliberately do not receive a number of their own.
 */
export const buildCommentNumbers = (comments: Comment[]) => {
  const roots = comments.filter((comment) => comment.parent_id == null);
  const ordered = [...roots].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime() ||
      a.id.localeCompare(b.id)
  );

  return new Map(ordered.map((comment, index) => [comment.id, index + 1]));
};
