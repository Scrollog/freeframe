'use client'

import * as React from 'react'
import useSWR from 'swr'
import { Check, Palette, RotateCcw, Upload, X } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type Slot = 'logo-light' | 'logo-dark' | 'login-logo' | 'favicon' | 'apple-icon'
type Branding = {
  org_name: string; primary_color: string | null; powered_by_freeframe: boolean
  logo_light_url: string | null; logo_dark_url: string | null; login_logo_url: string | null
  favicon_url: string | null; apple_icon_url: string | null
}
const slots: { id: Slot; label: string; field: keyof Branding; accept: string }[] = [
  { id: 'logo-dark', label: 'Dark theme logo', field: 'logo_dark_url', accept: 'image/png,image/jpeg,image/webp,image/svg+xml' },
  { id: 'logo-light', label: 'Light theme logo', field: 'logo_light_url', accept: 'image/png,image/jpeg,image/webp,image/svg+xml' },
  { id: 'login-logo', label: 'Login logo', field: 'login_logo_url', accept: 'image/png,image/jpeg,image/webp,image/svg+xml' },
  { id: 'favicon', label: 'Favicon', field: 'favicon_url', accept: 'image/png,image/svg+xml,image/x-icon' },
  { id: 'apple-icon', label: 'Apple touch icon', field: 'apple_icon_url', accept: 'image/png,image/jpeg,image/webp' },
]

function AssetSlot({ slot, url, disabled, refresh }: { slot: typeof slots[number]; url: string | null; disabled: boolean; refresh: () => void }) {
  const input = React.useRef<HTMLInputElement>(null); const [busy, setBusy] = React.useState(false); const [error, setError] = React.useState('')
  async function upload(file: File) {
    if (file.size > 5 * 1024 * 1024) return setError('File must be 5 MB or smaller.')
    setBusy(true); setError('')
    try {
      const signed = await api.post<{ upload_url: string; key: string }>(`/instance/branding/${slot.id}-upload?content_type=${encodeURIComponent(file.type)}`)
      const result = await fetch(signed.upload_url, { method: 'PUT', headers: { 'Content-Type': file.type }, body: file })
      if (!result.ok) throw new Error('Storage upload failed.')
      await api.post(`/instance/branding/${slot.id}-confirm`, { key: signed.key }); refresh()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Upload failed.') } finally { setBusy(false) }
  }
  return <div className="rounded-lg border border-border bg-bg-secondary p-4"><div className="flex gap-3"><div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-bg-tertiary">{url ? <img src={url} alt={slot.label} className="h-full w-full object-contain p-1" /> : <span className="text-2xs text-text-tertiary">None</span>}</div><div className="min-w-0 flex-1"><p className="text-sm font-medium text-text-primary">{slot.label}</p><div className="mt-3 flex gap-2"><input ref={input} className="hidden" type="file" accept={slot.accept} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void upload(f) }} /><Button size="sm" variant="secondary" disabled={disabled || busy} onClick={() => input.current?.click()}><Upload className="h-3.5 w-3.5" />{busy ? 'Uploading…' : url ? 'Replace' : 'Upload'}</Button>{url && <Button size="sm" variant="ghost" disabled={disabled || busy} onClick={() => { setBusy(true); void api.delete(`/instance/branding/${slot.id}`).then(refresh).finally(() => setBusy(false)) }}><X className="h-3.5 w-3.5" />Remove</Button>}</div>{error && <p className="mt-2 text-xs text-status-error">{error}</p>}</div></div></div>
}

export default function BrandingPage() {
  const { user } = useAuthStore(); const admin = Boolean(user?.is_superadmin)
  const { data, mutate } = useSWR<Branding>('/instance/branding', () => api.get<Branding>('/instance/branding'))
  const [name, setName] = React.useState(''); const [color, setColor] = React.useState(''); const [saving, setSaving] = React.useState(false)
  React.useEffect(() => { if (data) { setName(data.org_name); setColor(data.primary_color ?? '') } }, [data])
  if (!data) return <div className="p-6 text-sm text-text-secondary">Loading branding…</div>
  async function save(values: Record<string, unknown>) { setSaving(true); try { await api.put('/instance/branding', values); await mutate() } finally { setSaving(false) } }
  return <div className="max-w-3xl space-y-8 p-6"><header className="flex gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent-muted"><Palette className="h-5 w-5 text-accent" /></div><div><h1 className="text-lg font-semibold text-text-primary">Global branding</h1><p className="text-sm text-text-secondary">Applies to the whole instance and public pages.</p></div></header><section className="space-y-3"><h2 className="text-sm font-semibold">Identity</h2><div className="space-y-3 rounded-lg border border-border bg-bg-secondary p-4"><label className="block text-xs text-text-secondary">Organisation name<Input className="mt-1" disabled={!admin} value={name} onChange={(e) => setName(e.target.value)} /></label><label className="block text-xs text-text-secondary">Accent colour<Input className="mt-1" disabled={!admin} placeholder="#7c3aed" value={color} onChange={(e) => setColor(e.target.value)} /></label><label className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!admin} checked={data.powered_by_freeframe} onChange={(e) => void save({ powered_by_freeframe: e.target.checked })} />Show “Powered by FreeFrame”</label><Button size="sm" disabled={!admin || saving || !name.trim()} onClick={() => void save({ org_name: name.trim(), primary_color: color || null })}>{saving ? 'Saving…' : <><Check className="h-3.5 w-3.5" />Save identity</>}</Button></div></section><section className="space-y-3"><h2 className="text-sm font-semibold">Assets</h2><p className="text-xs text-text-tertiary">Validated server-side; maximum 5 MB per file.</p><div className="grid gap-3 sm:grid-cols-2">{slots.map((slot) => <AssetSlot key={slot.id} slot={slot} url={data[slot.field] as string | null} disabled={!admin} refresh={() => void mutate()} />)}</div></section><section className="rounded-lg border border-border bg-bg-secondary p-4"><p className="text-2xs uppercase text-text-tertiary">Preview</p><div className="mt-3 flex items-center gap-3"><div className="flex h-9 w-9 items-center justify-center rounded-md bg-bg-tertiary">{data.logo_dark_url ? <img src={data.logo_dark_url} alt="" className="h-full w-full object-contain p-1" /> : <Palette className="h-4 w-4 text-text-tertiary" />}</div><span className="font-semibold text-text-primary">{data.org_name}</span></div></section>{admin && <Button variant="ghost" size="sm" className="text-status-error" onClick={() => void api.delete('/instance/branding').then(() => mutate())}><RotateCcw className="h-3.5 w-3.5" />Reset all branding</Button>}{!admin && <p className="text-xs text-text-tertiary">Only super administrators can edit global branding.</p>}</div>
}
