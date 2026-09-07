import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

const push = vi.fn()
const post = vi.fn()

vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }))
vi.mock('@/lib/api', () => ({
  api: { post: (...args: unknown[]) => post(...args) },
  ApiError: class ApiError extends Error {
    detail: string
    constructor(detail: string) {
      super(detail)
      this.detail = detail
    }
  },
}))
vi.mock('@/lib/auth', () => ({ setTokens: vi.fn() }))
vi.mock('@/stores/auth-store', () => ({ useAuthStore: { getState: vi.fn() } }))

import { LoginForm } from '../login-form'

async function requestCodeFor(email: string) {
  render(<LoginForm />)
  fireEvent.click(screen.getByRole('button', { name: /back to magic link/i }))
  fireEvent.change(screen.getByLabelText(/email address/i), { target: { value: email } })
  fireEvent.click(screen.getByRole('button', { name: /send magic code/i }))
  await waitFor(() => expect(screen.getByText(/check your email/i)).toBeInTheDocument())
}

describe('LoginForm magic-code step', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // The endpoint intentionally gives this same response for known and
    // unknown accounts, preventing it from being used to enumerate users.
    post.mockResolvedValue({})
  })

  it('does not assert that a code was sent for an address the API cannot confirm', async () => {
    await requestCodeFor('nobody@example.invalid')

    expect(screen.queryByText(/we sent a 6-digit code/i)).not.toBeInTheDocument()
    expect(screen.getByText(/has an account, a 6-digit code is on its way/i)).toBeInTheDocument()
    expect(screen.getByText('nobody@example.invalid')).toBeInTheDocument()
  })

  it('shows an actionable typo hint without revealing account existence', async () => {
    await requestCodeFor('typo@example.invalid')

    expect(screen.getByText(/check the address for typos/i)).toBeInTheDocument()
  })

  it('returns to the email step so the address can be corrected', async () => {
    await requestCodeFor('wrong@example.invalid')
    fireEvent.click(screen.getByRole('button', { name: /use a different email/i }))

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /send magic code/i })).toBeInTheDocument(),
    )
  })
})
