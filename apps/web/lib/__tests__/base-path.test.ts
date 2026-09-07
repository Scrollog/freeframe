import { describe, expect, it } from 'vitest'
import { withBasePath } from '../base-path'

describe('withBasePath', () => {
  it('keeps root deployments unchanged', () => {
    expect(withBasePath('/login')).toBe('/login')
  })
})
