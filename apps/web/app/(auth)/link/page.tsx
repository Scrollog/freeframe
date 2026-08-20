'use client'

/**
 * Hands the signed-in session to a desktop client (the Premiere panel).
 *
 * The panel opens this page with a loopback address it is listening on. If a
 * session exists we clone it and POST the new tokens straight back — no code
 * to type, no button to press. If not, the login page sends the user back here
 * afterwards and it completes on its own.
 */

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle2, Loader2, XCircle } from 'lucide-react'
import { getAccessToken } from '@/lib/auth'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

type Phase = 'working' | 'done' | 'failed'

/** Only ever hand tokens to a loopback listener on this machine. */
function isLoopback(target: string): boolean {
  try {
    const url = new URL(target)
    return (
      url.protocol === 'http:' &&
      (url.hostname === '127.0.0.1' || url.hostname === 'localhost' || url.hostname === '[::1]')
    )
  } catch {
    return false
  }
}

export default function LinkPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [phase, setPhase] = useState<Phase>('working')
  const [message, setMessage] = useState('Connecting Premiere Pro…')

  const redirect = params.get('redirect') ?? ''
  const state = params.get('state') ?? ''

  useEffect(() => {
    if (!redirect || !state) {
      setPhase('failed')
      setMessage('This link is missing information. Start again from the Premiere panel.')
      return
    }
    if (!isLoopback(redirect)) {
      // A non-loopback target would mean sending someone's session to a remote
      // host — the one thing this page must never do.
      setPhase('failed')
      setMessage('That destination is not allowed.')
      return
    }

    const token = getAccessToken()
    if (!token) {
      const back = `/link?redirect=${encodeURIComponent(redirect)}&state=${encodeURIComponent(state)}`
      router.replace(`/login?from=${encodeURIComponent(back)}`)
      return
    }

    let cancelled = false
    ;(async () => {
      try {
        // A separate session, so signing out of the browser doesn't sign out
        // Premiere — and vice versa.
        const response = await fetch(`${API_URL}/auth/session/clone`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!response.ok) throw new Error('Could not create a session for Premiere.')
        const tokens = await response.json()

        await fetch(redirect, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            state,
            access_token: tokens.access_token,
            refresh_token: tokens.refresh_token,
          }),
        })
        if (cancelled) return
        setPhase('done')
        setMessage('Please return to Premiere Pro.')
      } catch (error) {
        if (cancelled) return
        setPhase('failed')
        setMessage('Premiere did not answer. Make sure the panel is still open, then try again.')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [redirect, state, router])

  const heading =
    phase === 'done'
      ? 'Authentication complete'
      : phase === 'failed'
        ? 'Not connected'
        : 'Connecting to Premiere Pro'

  return (
    <div className="flex flex-col items-center gap-4 py-2 text-center">
      {phase === 'working' && (
        <Loader2 className="h-8 w-8 animate-spin text-accent" aria-hidden />
      )}
      {phase === 'done' && (
        <CheckCircle2 className="h-8 w-8 text-status-success" aria-hidden />
      )}
      {phase === 'failed' && <XCircle className="h-8 w-8 text-status-error" aria-hidden />}

      <div className="space-y-1">
        <h1 className="text-base font-semibold text-text-primary">{heading}</h1>
        <p className="text-sm text-text-secondary">{message}</p>
      </div>

      {phase === 'done' && (
        // No deep link exists for a CEP panel, so there is nothing a button
        // here could honestly do — the panel has already signed itself in.
        <p className="text-2xs text-text-tertiary">You can close this tab.</p>
      )}
    </div>
  )
}
