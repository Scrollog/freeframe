import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'

const mocks = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/lib/api', () => ({ api: { get: mocks.get } }))

import { GlobalBranding } from '../global-branding'

describe('GlobalBranding', () => {
  afterEach(() => { vi.clearAllMocks(); document.head.querySelectorAll('[data-global-branding]').forEach((n) => n.remove()) })

  it('uses the configured title, icons and accent', async () => {
    mocks.get.mockResolvedValue({ org_name: 'Acme Studio', primary_color: '#7c3aed', favicon_url: 'https://cdn.test/favicon.png', apple_icon_url: null })
    render(<GlobalBranding />)
    await waitFor(() => expect(document.title).toBe('Acme Studio'))
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#7c3aed')
    expect(document.head.querySelector('link[data-global-branding="icon"]')).toHaveAttribute('href', 'https://cdn.test/favicon.png')
  })
})
