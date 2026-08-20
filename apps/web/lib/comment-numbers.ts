type NumberedComment = {
  id: string
  parent_id?: string | null
  timecode_start?: number | null
  created_at: string
}

/**
 * Stable display number for each root comment, shared by every surface that
 * shows one (`#3` in the side panel, on a timeline marker's tooltip, ...).
 *
 * Why this exists instead of a positional `index + 1`:
 *
 * The panel used to number by position in its own sorted+filtered list, so the
 * same comment was `#2` sorted by timecode and `#7` sorted by newest, and
 * searching renumbered everything left in view. A number that moves is worse
 * than no number — it cannot survive being spoken out loud ("fix #3") or
 * written into an export, which is the whole point of having one.
 *
 * The timeline could not reuse that numbering at all: its markers are split
 * across two filtered lists (point vs range, both excluding resolved), each
 * indexed from zero, so a point marker and a range marker would both claim
 * `#1`.
 *
 * Ordering is always chronological: the oldest root comment is `#1` and each
 * later root comment increments the number. This stays independent from the
 * panel's current visual sort or a comment's timecode.
 *
 * Replies are excluded: they are addressed as replies to their parent, and
 * numbering them would compete with the parent's number.
 */
export function buildCommentNumbers<T extends NumberedComment>(comments: T[]): Map<string, number> {
  const roots = comments.filter((c) => c.parent_id == null)

  const ordered = [...roots].sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    || a.id.localeCompare(b.id),
  )

  return new Map(ordered.map((c, i) => [c.id, i + 1]))
}
