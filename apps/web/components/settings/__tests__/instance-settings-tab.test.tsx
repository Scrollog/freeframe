import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

const h = vi.hoisted(() => {
  // Controllable, STABLE `data` reference (mirrors real SWR's cache — a fresh object each
  // render would re-fire the component's effect and clobber the in-progress input).
  const DEFAULT = {
    storage_limit_bytes: 0,
    storage_used_bytes: 1024 ** 3,
    share_metadata_title: 'FreeFrame',
    share_metadata_description: 'Collaborative media review and approval platform',
  }
  return { DEFAULT, data: DEFAULT as typeof DEFAULT | undefined }
})
vi.mock('swr', () => ({
  default: () => ({ data: h.data, isLoading: false }),
  mutate: vi.fn(),
}))
const put = vi.fn().mockResolvedValue({})
vi.mock('@/lib/api', () => ({ api: { put: (...a: unknown[]) => put(...a) } }))

import { InstanceSettingsTab } from '../instance-settings-tab'

describe('InstanceSettingsTab', () => {
  beforeEach(() => {
    put.mockClear()
    h.data = h.DEFAULT
  })

  it('saves the GB input as bytes via PUT', async () => {
    render(<InstanceSettingsTab />)
    fireEvent.change(screen.getByLabelText(/storage limit/i), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/instance/settings', { storage_limit_bytes: 10 * 1024 ** 3 }),
    )
  })

  it('saves 0 (unlimited) when the input is blank', async () => {
    render(<InstanceSettingsTab />)
    fireEvent.change(screen.getByLabelText(/storage limit/i), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/instance/settings', { storage_limit_bytes: 0 }),
    )
  })

  it('saves the public share preview metadata', async () => {
    render(<InstanceSettingsTab />)
    fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: 'Scroll Review' } })
    fireEvent.change(screen.getByLabelText(/^description$/i), { target: { value: 'Review this cut.' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() =>
      expect(put).toHaveBeenCalledWith('/instance/settings', {
        storage_limit_bytes: 0,
        share_metadata_title: 'Scroll Review',
        share_metadata_description: 'Review this cut.',
      }),
    )
  })

  it('disables Save until settings have loaded (so a pre-load click cannot PUT 0 and wipe a cap)', () => {
    h.data = undefined
    render(<InstanceSettingsTab />)
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
  })
})
