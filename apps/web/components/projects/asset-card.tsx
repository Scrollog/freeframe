'use client'

import * as React from 'react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Download, Link as LinkIcon, MoreHorizontal, Pencil, Share2, Trash2 } from 'lucide-react'
import { SharedAssetCard } from '@/components/shared/asset-card'
import { api } from '@/lib/api'
import type { Asset } from '@/types'
import type { AspectRatio, ThumbnailScale, TitleLines } from '@/stores/view-store'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

const aspectMap: Record<AspectRatio, string> = {
  landscape: 'aspect-[16/10]',
  square: 'aspect-square',
  portrait: 'aspect-[3/4]',
}

interface AssetCardProps {
  asset: Asset
  projectId: string
  versionCount?: number
  authorName?: string
  thumbnailUrl?: string | null
  commentCount?: number
  duration?: number | null
  selected?: boolean
  active?: boolean
  onSelect?: () => void
  onDragStart?: (event: React.DragEvent) => void
  onShare?: () => void
  onDownload?: () => void
  onRename?: () => void
  onDelete?: () => void
  fileSize?: number | null
  showInfo?: boolean
  showFileSize?: boolean
  showUploader?: boolean
  titleLines?: TitleLines
  aspectRatio?: AspectRatio
  thumbnailScale?: ThumbnailScale
  className?: string
}

/** Project adapter for the canonical shared asset card. */
export function AssetCard({
  asset,
  projectId,
  versionCount = 1,
  authorName,
  thumbnailUrl,
  commentCount,
  duration,
  selected = false,
  active = false,
  onSelect,
  onDragStart,
  onShare,
  onDownload,
  onRename,
  onDelete,
  fileSize,
  showInfo = true,
  showFileSize = true,
  showUploader = true,
  titleLines = '1',
  aspectRatio = 'landscape',
  thumbnailScale = 'fit',
  className,
}: AssetCardProps) {
  const titleClassName = titleLines === '1' ? 'line-clamp-1' : titleLines === '2' ? 'line-clamp-2' : 'line-clamp-3'
  const hasActions = onShare || onDownload || onRename || onDelete

  const actionMenu = hasActions ? (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Actions for ${asset.name}`}
          onClick={(event) => event.stopPropagation()}
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-text-tertiary opacity-0 outline-none transition-all group-hover:opacity-100 hover:bg-bg-hover hover:text-text-primary"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          side="bottom"
          align="start"
          sideOffset={6}
          collisionPadding={12}
          className="z-[100] min-w-[200px] origin-[var(--radix-dropdown-menu-content-transform-origin)] rounded-xl border border-border bg-bg-elevated py-1.5 shadow-2xl data-[state=open]:animate-scale-in"
          onClick={(event) => event.stopPropagation()}
        >
          {onShare && (
            <DropdownMenu.Item onSelect={onShare} className="flex cursor-pointer items-center gap-2.5 mx-1 rounded-lg px-2.5 py-2 text-sm text-text-secondary outline-none transition-colors hover:bg-bg-hover hover:text-text-primary">
              <Share2 className="h-3.5 w-3.5 text-text-tertiary" /> Create Share Link
            </DropdownMenu.Item>
          )}
          {onShare && (onDownload || onRename || onDelete) && <DropdownMenu.Separator className="my-1 h-px bg-border mx-1" />}
          {onDownload && (
            <DropdownMenu.Item onSelect={onDownload} className="flex cursor-pointer items-center gap-2.5 mx-1 rounded-lg px-2.5 py-2 text-sm text-text-secondary outline-none transition-colors hover:bg-bg-hover hover:text-text-primary">
              <Download className="h-3.5 w-3.5 text-text-tertiary" /> Download
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Item
            onSelect={() => navigator.clipboard.writeText(`${window.location.origin}/projects/${projectId}/assets/${asset.id}`)}
            className="flex cursor-pointer items-center gap-2.5 mx-1 rounded-lg px-2.5 py-2 text-sm text-text-secondary outline-none transition-colors hover:bg-bg-hover hover:text-text-primary"
          >
            <LinkIcon className="h-3.5 w-3.5 text-text-tertiary" /> Copy Asset URL
          </DropdownMenu.Item>
          {(onRename || onDelete) && <DropdownMenu.Separator className="my-1 h-px bg-border mx-1" />}
          {onRename && (
            <DropdownMenu.Item onSelect={onRename} className="flex cursor-pointer items-center gap-2.5 mx-1 rounded-lg px-2.5 py-2 text-sm text-text-secondary outline-none transition-colors hover:bg-bg-hover hover:text-text-primary">
              <Pencil className="h-3.5 w-3.5 text-text-tertiary" /> Rename
            </DropdownMenu.Item>
          )}
          {onDelete && (
            <DropdownMenu.Item onSelect={onDelete} className="flex cursor-pointer items-center gap-2.5 mx-1 rounded-lg px-2.5 py-2 text-sm text-status-error outline-none transition-colors hover:bg-status-error/10">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </DropdownMenu.Item>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  ) : null

  return (
    <SharedAssetCard
      asset={{
        id: asset.id,
        name: asset.name,
        assetType: asset.asset_type,
        thumbnailUrl,
        commentCount,
        versionCount,
        durationSeconds: duration,
        createdByName: authorName,
        createdAt: asset.created_at,
        fileSize,
      }}
      selected={selected}
      active={active}
      onToggleSelection={onSelect}
      draggable
      onDragStart={onDragStart}
      actionMenu={actionMenu}
      getVideoPreviewUrl={asset.asset_type === 'video' ? async () => {
        const response = await api.get<{ url?: string }>(`/assets/${asset.id}/stream`)
        if (!response.url) return null
        return response.url.startsWith('/') ? `${API_URL}${response.url}` : response.url
      } : undefined}
      aspectClass={aspectMap[aspectRatio]}
      thumbnailScale={thumbnailScale}
      showInfo={showInfo}
      showFileSize={showFileSize}
      showUploader={showUploader}
      titleClassName={titleClassName}
      className={className}
    />
  )
}
