import { describe, expect, it } from 'vitest'

import { getEdgeSeekDelta, isRapidRepeatEdgeClick } from '../video-player'

describe('getEdgeSeekDelta', () => {
  it('seeks two seconds backward from the left edge', () => {
    expect(getEdgeSeekDelta(30, 300)).toBe(-2)
  })

  it('seeks two seconds forward from the right edge', () => {
    expect(getEdgeSeekDelta(280, 300)).toBe(2)
  })

  it('keeps the center click for play and pause', () => {
    expect(getEdgeSeekDelta(150, 300)).toBe(0)
  })

  it('only seeks after two rapid clicks on the same edge', () => {
    expect(isRapidRepeatEdgeClick({ side: -1, at: 100 }, -1, 450)).toBe(true)
    expect(isRapidRepeatEdgeClick({ side: -1, at: 100 }, 1, 200)).toBe(false)
    expect(isRapidRepeatEdgeClick({ side: -1, at: 100 }, -1, 501)).toBe(false)
  })
})
