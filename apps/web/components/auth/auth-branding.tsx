'use client'

import { useInstanceBranding } from '@/components/shared/global-branding'
import { useThemeStore } from '@/stores/theme-store'

export function AuthBranding() { const { data } = useInstanceBranding(); const { theme } = useThemeStore(); const logo = data?.login_logo_url || (theme === 'light' ? data?.logo_light_url || data?.logo_dark_url : data?.logo_dark_url || data?.logo_light_url); return <div className="relative mb-10 text-center">{logo ? <img src={logo} alt={data?.org_name || 'FreeFrame'} className="mx-auto h-12 w-auto object-contain" /> : <img src="/logo-full.png" alt="FreeFrame" className="mx-auto h-12 w-auto" />}</div> }
