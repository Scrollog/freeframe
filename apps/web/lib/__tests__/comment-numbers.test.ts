import { describe, expect, it } from 'vitest'
import { buildCommentNumbers } from '../comment-numbers'

const comment = (id: string, timecode_start: number | null, created_at: string, parent_id: string | null = null) => ({
  id,
  timecode_start,
  created_at,
  parent_id,
})

describe('buildCommentNumbers', () => {
  it('numbers root threads by timecode, then creation order, regardless of input order', () => {
    const numbers = buildCommentNumbers([
      comment('untimed', null, '2026-01-03T00:00:00Z'),
      comment('later', 20, '2026-01-02T00:00:00Z'),
      comment('first', 10, '2026-01-01T00:00:00Z'),
      comment('reply', 12, '2026-01-01T00:00:00Z', 'first'),
    ])

    expect(Array.from(numbers.entries())).toEqual([
      ['first', 1],
      ['later', 2],
      ['untimed', 3],
    ])
  })

  it('uses the id as a stable final tie-breaker', () => {
    const numbers = buildCommentNumbers([
      comment('b', 10, '2026-01-01T00:00:00Z'),
      comment('a', 10, '2026-01-01T00:00:00Z'),
    ])

    expect(Array.from(numbers.entries())).toEqual([['a', 1], ['b', 2]])
  })
})
