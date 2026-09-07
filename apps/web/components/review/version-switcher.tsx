'use client'

import * as React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { AlertCircle, Loader2, CheckCircle2, ChevronDown, Layers, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useReviewStore } from '@/stores/review-store'
import type { AssetVersion, AssetVersionStatus } from '@/types'

export const versionStatusConfig: Record<
  AssetVersionStatus,
  { label: string; className: string; icon: React.ReactNode }
> = {
  uploading: {
    label: 'Uploading',
    className: 'text-status-info',
    icon: <Loader2 className="h-2.5 w-2.5 animate-spin" />,
  },
  processing: {
    label: 'Processing',
    className: 'text-status-warning',
    icon: <Loader2 className="h-2.5 w-2.5 animate-spin" />,
  },
  ready: {
    label: 'Ready',
    className: 'text-status-success',
    icon: <CheckCircle2 className="h-2.5 w-2.5" />,
  },
  failed: {
    label: 'Failed',
    className: 'text-status-error',
    icon: <AlertCircle className="h-2.5 w-2.5" />,
  },
}

export interface ProcessingProgress {
  versionId: string
  percent: number
}

interface VersionSwitcherProps {
  versions: AssetVersion[]
  className?: string
  compact?: boolean
  processingProgress?: ProcessingProgress | null
  canDelete?: boolean
  onDeleteVersion?: (version: AssetVersion) => void
}

export function VersionSwitcher({
  versions,
  className,
  compact = false,
  processingProgress = null,
  canDelete = false,
  onDeleteVersion,
}: VersionSwitcherProps) {
  const currentVersion = useReviewStore((s) => s.currentVersion)
  const setCurrentVersion = useReviewStore((s) => s.setCurrentVersion)

  const sorted = React.useMemo(
    () => [...versions].sort((a, b) => a.version_number - b.version_number),
    [versions],
  )

  if (sorted.length === 0) return null

  // Surface an in-flight new version (uploading/transcoding) on the always-visible
  // trigger — otherwise its status is only visible after opening the dropdown (#118).
  const latest = sorted[sorted.length - 1]
  const latestStatus = latest?.processing_status
  const inFlightCfg =
    latestStatus === 'uploading' || latestStatus === 'processing'
      ? versionStatusConfig[latestStatus]
      : null
  const inFlightLabel =
    latestStatus === 'processing' && processingProgress?.versionId === latest.id
      ? `Processing ${Math.round(processingProgress.percent)}%`
      : inFlightCfg?.label

  return (
    <div className={cn('flex items-center gap-1.5', className)}>
      {!compact && <span className="text-xs text-text-tertiary shrink-0">Version:</span>}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            aria-label="Select version"
            title="Versions"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md bg-accent text-white text-xs font-medium hover:bg-accent/90 transition-colors outline-none',
              compact ? 'mobile-touch-target h-8 w-8 justify-center' : 'px-2.5 py-1',
            )}
          >
            {compact ? <Layers className="h-4 w-4" /> : <span>v{currentVersion?.version_number ?? latest.version_number}</span>}
            {inFlightCfg && !compact && (
              <span
                data-testid="version-status-indicator"
                className="inline-flex items-center gap-1 text-[11px] text-white/90"
                title={`v${latest.version_number} — ${inFlightLabel}`}
              >
                {inFlightCfg.icon}
                {inFlightLabel}
              </span>
            )}
            {sorted.length > 1 && <ChevronDown className="h-3 w-3 opacity-70" />}
          </button>
        </DropdownMenu.Trigger>
        {sorted.length > 1 && (
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              align="end"
              sideOffset={6}
              className="z-[100] min-w-[160px] rounded-xl border border-border bg-bg-elevated shadow-2xl py-1.5 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
            >
              {sorted.map((version) => {
                const isActive = currentVersion?.id === version.id
                const statusCfg = versionStatusConfig[version.processing_status]
                const isDisabled =
                  version.processing_status === 'uploading' ||
                  version.processing_status === 'processing'
                return (
                  <div key={version.id} className="flex items-center gap-0.5 mx-1">
                    <DropdownMenu.Item
                      disabled={isDisabled}
                      onSelect={() => setCurrentVersion(version)}
                      className={cn(
                        'flex flex-1 items-center justify-between gap-3 px-2.5 py-2 rounded-lg text-sm cursor-pointer outline-none transition-colors',
                        isActive
                          ? 'bg-accent/10 text-accent font-medium'
                          : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary',
                        isDisabled && 'opacity-50 cursor-not-allowed',
                      )}
                    >
                      <span>v{version.version_number}</span>
                      <span
                        className={cn('inline-flex items-center gap-1 text-[11px]', statusCfg.className)}
                        title={statusCfg.label}
                      >
                        {statusCfg.icon}
                        {statusCfg.label}
                      </span>
                    </DropdownMenu.Item>
                    {canDelete && !isDisabled && (
                      <DropdownMenu.Item
                        aria-label={`Delete version ${version.version_number}`}
                        title={`Delete v${version.version_number}`}
                        onSelect={() => onDeleteVersion?.(version)}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-text-tertiary outline-none transition-colors hover:bg-status-error/10 hover:text-status-error"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </DropdownMenu.Item>
                    )}
                  </div>
                )
              })}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        )}
      </DropdownMenu.Root>
    </div>
  )
}
