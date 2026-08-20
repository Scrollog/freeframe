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
 * Ordering matches the panel's default sort — timecoded ascending, then
 * untimecoded by creation — so the numbers a reviewer already sees stay put.
 *
 * Replies are excluded: they are addressed as replies to their parent, and
 * numbering them would compete with the parent's number.
 */
export function buildCommentNumbers<T extends NumberedComment>(comments: T[]): Map<string, number> {
  const roots = comments.filter((c) => c.parent_id == null)

  const ordered = [...roots].sort((a, b) => {
    const aTime = a.timecode_start ?? null
    const bTime = b.timecode_start ?? null
    if (aTime !== null && bTime !== null && aTime !== bTime) return aTime - bTime
    if (aTime !== null && bTime === null) return -1
    if (aTime === null && bTime !== null) return 1
    // Same timecode, or neither has one: fall back to creation order so the
    // result is a total order. Without this, two comments on the same frame
    // could swap numbers between renders.
    const createdAt = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    return createdAt || a.id.localeCompare(b.id)
  })

  return new Map(ordered.map((c, i) => [c.id, i + 1]))
}
