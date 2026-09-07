'use client'

import { useEffect } from 'react'
import useSWR from 'swr'
import { api } from '@/lib/api'

export type InstanceBranding = { org_name: string; primary_color: string | null; favicon_url: string | null; apple_icon_url: string | null; logo_dark_url: string | null; logo_light_url: string | null; login_logo_url: string | null; powered_by_freeframe: boolean }
export function useInstanceBranding() { return useSWR<InstanceBranding>('/instance/branding', () => api.get<InstanceBranding>('/instance/branding')) }
function icon(rel: string, href: string) { let node = document.querySelector<HTMLLinkElement>(`link[data-global-branding="${rel}"]`); if (!node) { node = document.createElement('link'); node.rel = rel; node.dataset.globalBranding = rel; document.head.append(node) } node.href = href }
export function GlobalBranding() { const { data } = useInstanceBranding(); useEffect(() => { if (!data) return; document.title = data.org_name; icon('icon', data.favicon_url || '/logo-icon.png'); icon('apple-touch-icon', data.apple_icon_url || '/logo-icon.png'); if (data.primary_color) document.documentElement.style.setProperty('--accent', data.primary_color); else document.documentElement.style.removeProperty('--accent') }, [data]); return null }
