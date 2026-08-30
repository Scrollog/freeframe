'use client'

import * as React from 'react'
import {
  Folder,
  File,
  Download,
  Search,
  ChevronRight,
  ChevronDown,
  Image as ImageIcon,
  Video,
  Music,
  Loader2,
  MessageSquare,
  Layers,
  PanelRightClose,
  PanelRightOpen,
  PanelBottomClose,
  PanelBottomOpen,
  GripHorizontal,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Globe,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { buildCommentNumbers } from '@/lib/comment-numbers'
import { getGuestCommentToken, removeGuestCommentToken } from '@/lib/guest-comment-tokens'
import { useReview, type CreateCommentPayload } from '@/components/review/review-provider'
import { useReviewStore } from '@/stores/review-store'
import { useMobileReviewSplit } from '@/hooks/use-mobile-review-split'
import { CommentThreadConnector } from '@/components/comments/comment-thread-connector'
import type {
  SharePermission,
  ShareLinkAppearance,
  FolderShareAssetsResponse,
  FolderShareAssetItem,
  FolderShareSubfolder,
  ProjectBranding,
} from '@/types'

export type ShareBranding = ProjectBranding & { logo_url?: string | null }

// ─── Constants ────────────────────────────────────────────────────────────────

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

// ─── Types ────────────────────────────────────────────────────────────────────

interface FolderShareViewerProps {
  token: string
  shareSession?: string | null
  folderName: string
  title: string
  description: string | null
  createdByName?: string | null
  createdByAvatarUrl?: string | null
  viewerName?: string | null
  permission: SharePermission
  allowDownload: boolean
  showVersions: boolean
  appearance: ShareLinkAppearance
  branding: ShareBranding | null
  onAssetClick?: (assetId: string) => void
  embedded?: boolean
  editableHeader?: boolean
  onTitleCommit?: (title: string) => void
  onDescriptionCommit?: (description: string | null) => void
}

function EditableShareTitle({
  value,
  editable,
  onCommit,
  className,
}: {
  value: string
  editable: boolean
  onCommit?: (value: string) => void
  className: string
}) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(value)

  React.useEffect(() => {
    if (!editing) setDraft(value)
  }, [editing, value])

  const commit = () => {
    const next = draft.trim()
    if (!next) {
      setDraft(value)
    } else if (next !== value) {
      onCommit?.(next)
    }
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            commit()
          }
          if (event.key === 'Escape') {
            setDraft(value)
            setEditing(false)
          }
        }}
        aria-label="Share link title"
        className={cn(className, 'w-full rounded-sm bg-black/15 px-1 -mx-1 outline-none ring-1 ring-accent')}
      />
    )
  }

  return (
    <h1
      className={cn(className, editable && 'cursor-text rounded-sm transition-colors hover:bg-black/10')}
      onClick={editable ? () => setEditing(true) : undefined}
    >
      {draft}
    </h1>
  )
}

function EditableShareDescription({
  value,
  editable,
  onCommit,
  className,
}: {
  value: string | null
  editable: boolean
  onCommit?: (value: string | null) => void
  className: string
}) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(value ?? '')

  React.useEffect(() => {
    if (!editing) setDraft(value ?? '')
  }, [editing, value])

  const commit = () => {
    const next = draft.trim()
    if (next !== (value ?? '')) onCommit?.(next || null)
    setEditing(false)
  }

  if (!value && !editable) return null
  if (editing) {
    return (
      <textarea
        autoFocus
        rows={2}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            setDraft(value ?? '')
            setEditing(false)
          }
        }}
        aria-label="Share link description"
        className={cn(className, 'w-full resize-none rounded-sm bg-black/15 px-1 -mx-1 outline-none ring-1 ring-accent')}
      />
    )
  }

  return (
    <p
      className={cn(
        className,
        editable && 'cursor-text rounded-sm transition-colors hover:bg-black/10',
        !draft && 'text-text-tertiary italic',
      )}
      onClick={editable ? () => setEditing(true) : undefined}
    >
      {draft || 'Add a description…'}
    </p>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatFileSize(bytes: number | null): string {
  if (bytes == null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} kB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function formatShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  })
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function getAssetTypeIcon(assetType: string): React.ElementType {
  switch (assetType) {
    case 'video': return Video
    case 'audio': return Music
    case 'image':
    case 'image_carousel': return ImageIcon
    default: return File
  }
}

function getAssetTypeBadgeLabel(assetType: string): string {
  switch (assetType) {
    case 'image_carousel': return 'Carousel'
    default: return assetType.charAt(0).toUpperCase() + assetType.slice(1)
  }
}

// ─── Download handler ─────────────────────────────────────────────────────────

function triggerDownload(url: string) {
  // Let the server's Content-Disposition filename win — don't set `a.download`,
  // since it would strip the extension the backend appended.
  const a = document.createElement('a')
  a.href = url
  a.rel = 'noopener noreferrer'
  a.style.display = 'none'
  document.body.appendChild(a)
  a.click()
  setTimeout(() => a.remove(), 1000)
}

async function fetchDownloadUrl(token: string, assetId: string, shareSession?: string | null): Promise<string | null> {
  const sp = shareSession ? `&share_session=${encodeURIComponent(shareSession)}` : ''
  try {
    const response = await fetch(`${API_URL}/share/${token}/stream/${assetId}?download=true${sp}`)
    if (!response.ok) return null
    const data = await response.json()
    return data?.url ?? null
  } catch {
    return null
  }
}

async function handleDownload(token: string, assetId: string, shareSession?: string | null) {
  const url = await fetchDownloadUrl(token, assetId, shareSession)
  if (url) triggerDownload(url)
}

async function collectAllAssetsRecursive(
  token: string,
  folderId: string | null,
  shareSession?: string | null,
): Promise<{ id: string; name: string }[]> {
  // Fetch assets + subfolders at this level, then recurse into subfolders.
  const sp = shareSession ? `&share_session=${encodeURIComponent(shareSession)}` : ''
  const folderParam = folderId ? `folder_id=${folderId}&` : ''
  try {
    const res = await fetch(`${API_URL}/share/${token}/assets?${folderParam}page=1&per_page=500${sp}`)
    if (!res.ok) return []
    const data = await res.json() as { assets?: { id: string; name: string }[]; subfolders?: { id: string }[] }
    const items: { id: string; name: string }[] = (data.assets ?? []).map((a) => ({ id: a.id, name: a.name }))
    const subfolders = data.subfolders ?? []
    for (const sub of subfolders) {
      const nested = await collectAllAssetsRecursive(token, sub.id, shareSession)
      items.push(...nested)
    }
    return items
  } catch {
    return []
  }
}

async function handleDownloadAll(
  token: string,
  folderId: string | null,
  shareSession?: string | null,
) {
  // Recursively collect all assets (including those in subfolders),
  // pre-fetch presigned URLs in parallel, then trigger downloads
  // sequentially with a delay so the browser doesn't block them.
  const allAssets = await collectAllAssetsRecursive(token, folderId, shareSession)
  const urls = await Promise.all(
    allAssets.map((a) => fetchDownloadUrl(token, a.id, shareSession)),
  )
  for (const url of urls) {
    if (!url) continue
    triggerDownload(url)
    await new Promise((r) => setTimeout(r, 800))
  }
}

// ─── Subfolder Card ───────────────────────────────────────────────────────────

interface SubfolderCardProps {
  subfolder: FolderShareSubfolder
  onClick: (subfolder: FolderShareSubfolder) => void
}

function SubfolderCard({ subfolder, onClick }: SubfolderCardProps) {
  const thumbs = subfolder.thumbnail_urls ?? []

  return (
    <button
      className="group flex flex-col rounded-lg border border-border bg-bg-tertiary overflow-hidden text-left transition-all cursor-pointer hover:border-border-focus hover:bg-bg-hover"
      onClick={() => onClick(subfolder)}
    >
      {/* Thumbnail area */}
      <div className="w-full aspect-[16/10] relative overflow-hidden bg-bg-tertiary">
        {thumbs.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Folder className="h-10 w-10 text-text-tertiary" />
          </div>
        ) : thumbs.length === 1 ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={thumbs[0]}
            alt={subfolder.name}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.03]"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
          />
        ) : (
          <div className={cn(
            'absolute inset-0 grid gap-[1px]',
            thumbs.length === 2 && 'grid-cols-2',
            thumbs.length >= 3 && 'grid-cols-2 grid-rows-2',
          )}>
            {thumbs.slice(0, 4).map((url, i) => (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                key={i}
                src={url}
                alt=""
                className={cn(
                  'h-full w-full object-cover',
                  thumbs.length === 3 && i === 0 && 'row-span-2',
                )}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-3 py-2.5">
        <p className="text-sm font-medium text-text-primary truncate">{subfolder.name}</p>
        <p className="text-xs text-text-tertiary mt-0.5">
          {subfolder.item_count} {subfolder.item_count === 1 ? 'Item' : 'Items'}
        </p>
      </div>
    </button>
  )
}

// ─── List row thumbnail with error fallback ───────────────────────────────────

function ListRowThumb({ asset, TypeIcon }: { asset: FolderShareAssetItem; TypeIcon: React.ElementType }) {
  const [imgError, setImgError] = React.useState(false)
  return (
    <div className="h-14 w-14 shrink-0 rounded-md overflow-hidden bg-bg-tertiary flex items-center justify-center">
      {asset.thumbnail_url && !imgError ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={asset.thumbnail_url} alt={asset.name} className="h-full w-full object-cover" onError={() => setImgError(true)} />
      ) : (
        <TypeIcon className="h-6 w-6 text-text-tertiary/60" />
      )}
    </div>
  )
}

// ─── Asset Grid Card (Frame.io style) ────────────────────────────────────────

interface AssetGridCardProps {
  asset: FolderShareAssetItem
  allowDownload: boolean
  token: string
  shareSession?: string | null
  isSelected: boolean
  onSelect: (asset: FolderShareAssetItem) => void
  onOpen: (asset: FolderShareAssetItem) => void
  aspectClass?: string
  thumbnailScale?: 'fit' | 'fill'
  showCardInfo?: boolean
  accentColor: string
}

function ScrubbableVideoThumbnail({
  asset,
  token,
  shareSession,
  thumbnailScale,
  onThumbnailError,
}: {
  asset: FolderShareAssetItem
  token: string
  shareSession?: string | null
  thumbnailScale: 'fit' | 'fill'
  onThumbnailError: () => void
}) {
  const [hovering, setHovering] = React.useState(false)
  const [ready, setReady] = React.useState(false)
  const [ratio, setRatio] = React.useState(0)
  const videoRef = React.useRef<HTMLVideoElement>(null)
  const hlsRef = React.useRef<{ destroy: () => void } | null>(null)
  const seekFrameRef = React.useRef<number | null>(null)
  const queuedRatioRef = React.useRef(0)
  const streamUrlRef = React.useRef<string | null>(null)

  const teardown = React.useCallback(() => {
    if (seekFrameRef.current !== null) cancelAnimationFrame(seekFrameRef.current)
    seekFrameRef.current = null
    hlsRef.current?.destroy()
    hlsRef.current = null
    const video = videoRef.current
    if (video) {
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
    setReady(false)
    setRatio(0)
  }, [])

  React.useEffect(() => {
    if (!hovering) {
      teardown()
      return
    }

    let cancelled = false
    const loadPreview = async () => {
      try {
        let streamUrl = streamUrlRef.current
        if (!streamUrl) {
          const params = new URLSearchParams({ _: '1' })
          if (shareSession) params.set('share_session', shareSession)
          const headers: Record<string, string> = {}
          try {
            const accessToken = localStorage.getItem('ff_access_token')
            if (accessToken) headers.Authorization = `Bearer ${accessToken}`
          } catch {}
          const response = await fetch(`${API_URL}/share/${token}/stream/${asset.id}?${params}`, { headers })
          if (!response.ok) throw new Error('Could not load preview')
          const data = await response.json() as { url?: string }
          if (!data.url) throw new Error('Preview URL missing')
          streamUrl = data.url.startsWith('/') ? `${API_URL}${data.url}` : data.url
          streamUrlRef.current = streamUrl
        }
        const video = videoRef.current
        if (cancelled || !video || !streamUrl) return

        if (!streamUrl.includes('.m3u8')) {
          video.src = streamUrl
          video.load()
          return
        }
        const { default: Hls } = await import('hls.js')
        if (cancelled || !videoRef.current) return
        if (Hls.isSupported()) {
          const hls = new Hls({ enableWorker: false, startLevel: 0, capLevelToPlayerSize: true })
          hls.loadSource(streamUrl)
          hls.attachMedia(videoRef.current)
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (!cancelled) setReady(true)
          })
          hlsRef.current = hls
        } else {
          videoRef.current.src = streamUrl
          videoRef.current.load()
        }
      } catch {
        // Keep the static thumbnail when the preview cannot be loaded.
      }
    }
    void loadPreview()
    return () => { cancelled = true }
  }, [asset.id, hovering, shareSession, teardown, token])

  React.useEffect(() => () => teardown(), [teardown])

  const seekToRatio = (nextRatio: number) => {
    queuedRatioRef.current = nextRatio
    if (seekFrameRef.current !== null) return
    seekFrameRef.current = requestAnimationFrame(() => {
      seekFrameRef.current = null
      const video = videoRef.current
      if (!video || !Number.isFinite(video.duration) || video.duration <= 0) return
      const nextTime = queuedRatioRef.current * video.duration
      try {
        if ('fastSeek' in video && typeof video.fastSeek === 'function') video.fastSeek(nextTime)
        else video.currentTime = nextTime
      } catch {}
    })
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.pointerType !== 'mouse') return
    const bounds = event.currentTarget.getBoundingClientRect()
    const nextRatio = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
    setRatio(nextRatio)
    if (ready) seekToRatio(nextRatio)
  }

  return (
    <div
      className="absolute inset-0 cursor-ew-resize"
      onPointerEnter={(event) => { if (event.pointerType === 'mouse') setHovering(true) }}
      onPointerLeave={() => setHovering(false)}
      onPointerMove={handlePointerMove}
    >
      {asset.thumbnail_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={asset.thumbnail_url}
          alt={asset.name}
          className={cn('h-full w-full transition-transform duration-200 group-hover:scale-[1.02]', thumbnailScale === 'fill' ? 'object-cover' : 'object-contain')}
          onError={onThumbnailError}
        />
      )}
      {hovering && (
        <video
          ref={videoRef}
          muted
          playsInline
          preload="metadata"
          onLoadedMetadata={() => setReady(true)}
          className={cn('absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-100', ready && 'opacity-100')}
        />
      )}
      {hovering && ready && <span className="pointer-events-none absolute inset-y-0 z-0 w-px bg-accent" style={{ left: `${ratio * 100}%` }} />}
    </div>
  )
}

function AssetGridCard({ asset, allowDownload, token, shareSession, isSelected, onSelect, onOpen, aspectClass = 'aspect-[16/10]', thumbnailScale = 'fill', showCardInfo = true, accentColor }: AssetGridCardProps) {
  const TypeIcon = getAssetTypeIcon(asset.asset_type)
  const [imgError, setImgError] = React.useState(false)

  return (
    <div
      className={cn(
        'group flex flex-col rounded-lg border overflow-hidden transition-all cursor-pointer',
        isSelected
          ? ''
          : 'border-border hover:border-border-focus',
        'bg-bg-tertiary hover:bg-bg-hover',
      )}
      style={isSelected ? { borderColor: accentColor } : undefined}
      onClick={() => onSelect(asset)}
      onDoubleClick={() => onOpen(asset)}
      onPointerUp={(event) => {
        if (event.pointerType === 'touch') onOpen(asset)
      }}
    >
      {/* Thumbnail */}
      <div className={cn('w-full relative overflow-hidden bg-bg-tertiary', aspectClass)}>
        {asset.thumbnail_url && !imgError && asset.asset_type === 'video' ? (
          <ScrubbableVideoThumbnail
            asset={asset}
            token={token}
            shareSession={shareSession}
            thumbnailScale={thumbnailScale}
            onThumbnailError={() => setImgError(true)}
          />
        ) : asset.thumbnail_url && !imgError ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={asset.thumbnail_url} alt={asset.name} className={cn('h-full w-full transition-transform duration-200 group-hover:scale-[1.02]', thumbnailScale === 'fill' ? 'object-cover' : 'object-contain')} onError={() => setImgError(true)} />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-bg-hover text-text-secondary">
              <TypeIcon className="h-7 w-7" />
            </div>
          </div>
        )}

        {/* Version count badge — top left (only when multiple versions exist) */}
        {(asset.version_count ?? 1) > 1 && (
          <div className="absolute z-10 top-2 left-2 flex items-center gap-1 bg-bg-primary/80 backdrop-blur-sm rounded-md px-1.5 py-0.5" title={`${asset.version_count} versions`}>
            <Layers className="h-3 w-3 text-text-primary" />
            <span className="text-[10px] font-medium text-text-primary tabular-nums">{asset.version_count}</span>
          </div>
        )}

        {/* Comment count badge — bottom left */}
        {asset.comment_count > 0 && (
          <div className="absolute z-10 bottom-2 left-2 flex h-6 min-w-11 items-center justify-center gap-1 rounded-md bg-black/85 px-1.5">
            <MessageSquare className="h-3 w-3 text-text-primary" />
            <span className="text-[10px] font-medium text-text-primary">{asset.comment_count}</span>
          </div>
        )}

        {/* Duration badge — bottom right (video/audio) */}
        {asset.duration_seconds != null && asset.duration_seconds > 0 && (
          <div className="absolute z-10 bottom-2 right-2 flex h-6 min-w-11 items-center justify-center rounded-md bg-black/85 px-1.5">
            <span className="text-[10px] font-medium text-text-primary tabular-nums">
              {formatDuration(asset.duration_seconds)}
            </span>
          </div>
        )}

        {/* Download button overlay */}
        {allowDownload && (
          <button
            className="absolute z-10 top-2 right-2 flex h-6 w-6 items-center justify-center rounded-md bg-black/85 text-text-primary opacity-0 transition-opacity hover:bg-black group-hover:opacity-100"
            onClick={(e) => {
              e.stopPropagation()
              handleDownload(token, asset.id, shareSession)
            }}
            onPointerUp={(e) => e.stopPropagation()}
            title="Download"
          >
            <Download className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Info — name, author, date */}
      {showCardInfo && (
        <div className="px-3 py-2.5">
          <p className="text-sm font-medium text-text-primary line-clamp-1">{asset.name}</p>
          <p className="text-xs text-text-tertiary mt-0.5 truncate">
            {asset.created_by_name && <>{asset.created_by_name} &middot; </>}
            {formatShortDate(asset.created_at)}
            {asset.file_size != null && <> &middot; {formatFileSize(asset.file_size)}</>}
          </p>
        </div>
      )}
    </div>
  )
}

// ─── Section Header ──────────────────────────────────────────────────────────

interface SectionHeaderProps {
  label: string
  count: number
  totalSize: string | null
  expanded: boolean
  onToggle: () => void
  actions?: React.ReactNode
}

function SectionHeader({ label, count, totalSize, expanded, onToggle, actions }: SectionHeaderProps) {
  return (
    <div className="flex items-center gap-3 py-2">
      <button className="flex flex-1 items-center gap-2 text-left group" onClick={onToggle}>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 transition-transform text-text-tertiary', !expanded && '-rotate-90')}
        />
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          {count} {label}
        </span>
        {totalSize && (
          <span className="text-xs text-text-tertiary">&middot; {totalSize}</span>
        )}
      </button>
      {actions}
    </div>
  )
}

// ─── Right Panel: Asset Details + Comments ───────────────────────────────────

interface RightPanelProps {
  selectedAsset: FolderShareAssetItem | null
  token: string
  permission: SharePermission
  allowDownload: boolean
  onOpenAsset?: (asset: FolderShareAssetItem) => void
}

interface GuestComment {
  id: string
  body: string
  guest_name: string
  guest_email: string
  author_name?: string
  author?: { id: string; name: string; avatar_url?: string | null } | null
  guest_author?: { id: string; name: string; email: string } | null
  created_at: string
  timecode_start?: number | null
  replies?: GuestComment[]
}

function RightPanel({ selectedAsset, token, permission, allowDownload, onOpenAsset }: RightPanelProps) {
  const [comments, setComments] = React.useState<GuestComment[]>([])
  const [loadingComments, setLoadingComments] = React.useState(false)
  const [commentRefresh, setCommentRefresh] = React.useState(0)
  const canComment = permission === 'comment' || permission === 'approve'

  React.useEffect(() => {
    if (!selectedAsset) {
      setComments([])
      return
    }
    setLoadingComments(true)
    // The grid preview has no version switcher — scope to the latest ready version
    // so it doesn't mix comments from every version.
    fetch(`${API_URL}/share/${token}/comments?asset_id=${selectedAsset.id}&latest_only=true`)
      .then((r) => (r.ok ? r.json() : Promise.resolve([])))
      .then((data) => setComments(Array.isArray(data) ? data : (data.comments ?? [])))
      .catch(() => setComments([]))
      .finally(() => setLoadingComments(false))
  }, [selectedAsset?.id, token, commentRefresh])

  if (!selectedAsset) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="h-14 w-14 rounded-full bg-bg-tertiary flex items-center justify-center mb-3">
          <MessageSquare className="h-7 w-7 text-text-tertiary" />
        </div>
        <p className="text-sm font-medium text-text-primary">Select an asset to view comments</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Asset name header — minimal */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <h3 className="text-sm font-semibold text-text-primary truncate">{selectedAsset.name}</h3>
      </div>

      {/* Comments section */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <h4 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">
            Comments ({comments.length})
          </h4>
        </div>
        <ShareCommentList comments={comments} loading={loadingComments} canComment={canComment} />
      </div>

      {/* Comment input — only in asset viewer, not in folder preview */}
    </div>
  )
}

// ─── Share Comment List (matches project review panel style) ─────────────────

const AVATAR_COLORS = [
  'bg-purple-500', 'bg-blue-500', 'bg-green-500', 'bg-orange-500',
  'bg-pink-500', 'bg-cyan-500', 'bg-indigo-500', 'bg-rose-500',
]

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

interface ShareCommentListProps {
  comments: GuestComment[]
  loading: boolean
  canComment: boolean
  onReply?: (commentId: string) => void
}

function ShareCommentList({ comments, loading, canComment, onReply }: ShareCommentListProps) {
  const commentNumbers = React.useMemo(() => buildCommentNumbers(comments), [comments])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-text-tertiary" />
      </div>
    )
  }

  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <MessageSquare className="h-8 w-8 text-text-tertiary mb-2" />
        <p className="text-sm font-medium text-text-primary">No comments yet</p>
        {canComment && <p className="text-xs text-text-tertiary mt-1">Be the first to leave feedback</p>}
      </div>
    )
  }

  return (
    <div className="space-y-2 px-3 py-3">
      {comments.map((comment) => {
        const name = comment.author?.name || comment.guest_author?.name || comment.guest_name || comment.author_name || 'User'
        const color = getAvatarColor(name)
        return (
          <CommentThreadConnector key={comment.id} active={Boolean(comment.replies?.length)}>
          <div className="relative rounded-lg border border-white/[0.06] bg-bg-primary/30 px-3 transition-colors hover:border-white/15 hover:bg-white/[0.02]">
            {/* Comment header */}
              <div className="relative z-[1] flex items-start gap-2.5 py-3">
              <div data-comment-thread-avatar className={cn('h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-text-primary shrink-0', color)}>
                {name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold text-text-primary">{name}</span>
                  <span className="text-[11px] text-text-tertiary">{formatShortDate(comment.created_at)}</span>
                  <span className="ml-auto text-2xs text-text-tertiary">#{commentNumbers.get(comment.id)}</span>
                  <Globe className="h-3.5 w-3.5 text-text-tertiary" />
                </div>
                {comment.timecode_start != null && (
                  <span className="inline-flex items-center gap-1 mt-1.5 text-[11px] text-amber-400 font-mono bg-amber-500/20 px-1.5 py-0.5 rounded-md">
                    {Math.floor(comment.timecode_start / 60)}:{String(Math.floor(comment.timecode_start % 60)).padStart(2, '0')}
                  </span>
                )}
                <p className="mt-1.5 text-[13px] leading-relaxed text-text-secondary">{comment.body}</p>
                {canComment && onReply && (
                  <button onClick={() => onReply(comment.id)} className="block mt-2 text-xs text-text-tertiary hover:text-text-primary transition-colors">
                    Reply
                  </button>
                )}
              </div>
            </div>

            {/* Nested replies */}
            {comment.replies && comment.replies.length > 0 && (
              <div className="mt-0.5">
                {comment.replies.map((r) => {
                  const rName = r.author?.name || r.guest_author?.name || r.guest_name || r.author_name || 'User'
                  const rColor = getAvatarColor(rName)
                  return (
                    <div key={r.id} className="relative z-[1] flex items-start gap-2.5 py-3">
                      <div data-comment-thread-avatar className={cn('mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-text-inverse', rColor)}>
                        {rName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[13px] font-semibold text-text-primary">{rName}</span>
                          <span className="text-[11px] text-text-tertiary">{formatShortDate(r.created_at)}</span>
                          <Globe className="ml-auto h-3.5 w-3.5 text-text-tertiary" />
                        </div>
                        <p className="mt-1 text-[13px] leading-relaxed text-text-secondary">{r.body}</p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
          </CommentThreadConnector>
        )
      })}
    </div>
  )
}

// ─── Share Comment Input ─────────────────────────────────────────────────────

interface ShareCommentInputProps {
  token: string
  assetId: string
  onCommentPosted: () => void
}

function ShareCommentInput({ token, assetId, onCommentPosted }: ShareCommentInputProps) {
  const [body, setBody] = React.useState('')
  const [guestName, setGuestName] = React.useState('')
  const [guestEmail, setGuestEmail] = React.useState('')
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  // Check if user is logged in
  const isLoggedIn = typeof window !== 'undefined' && !!localStorage.getItem('ff_access_token')

  async function handleSubmit() {
    if (!body.trim()) return
    if (!isLoggedIn && (!guestName.trim() || !guestEmail.trim())) {
      setError('Please enter your name and email')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' }
      const accessToken = localStorage.getItem('ff_access_token')
      if (accessToken) headers['Authorization'] = `Bearer ${accessToken}`

      const payload: Record<string, unknown> = { body: body.trim(), asset_id: assetId }
      if (!isLoggedIn) {
        payload.guest_name = guestName.trim()
        payload.guest_email = guestEmail.trim()
      }

      const res = await fetch(`${API_URL}/share/${token}/comment`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.detail || 'Failed to post comment')
      }
      setBody('')
      onCommentPosted()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="border-t border-border p-3 shrink-0 space-y-2">
      {!isLoggedIn && (
        <div className="flex gap-2">
          <input
            type="text"
            value={guestName}
            onChange={(e) => setGuestName(e.target.value)}
            placeholder="Your name"
            className="flex-1 h-8 rounded-md border border-border bg-bg-hover px-2.5 text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/50"
          />
          <input
            type="email"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
            placeholder="Email"
            className="flex-1 h-8 rounded-md border border-border bg-bg-hover px-2.5 text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/50"
          />
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() } }}
          placeholder="Leave a comment…"
          disabled={submitting}
          className="flex-1 h-8 rounded-md border border-border bg-bg-hover px-2.5 text-sm text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/50"
        />
        <button
          onClick={handleSubmit}
          disabled={submitting || !body.trim()}
          className="h-8 px-3 rounded-md bg-accent text-text-primary text-xs font-medium hover:bg-accent/90 disabled:opacity-50 transition-colors shrink-0"
        >
          {submitting ? '...' : 'Post'}
        </button>
      </div>
      {error && <p className="text-2xs text-red-400">{error}</p>}
    </div>
  )
}

// ─── Asset Viewer (full-screen media viewer for shared assets) ───────────────

interface AssetViewerProps {
  token: string
  shareSession?: string | null
  asset: FolderShareAssetItem
  permission: SharePermission
  allowDownload: boolean
  showVersions: boolean
  parentPath?: string
  onBack: () => void
}

function HlsVideo({ src, className }: { src: string; className?: string }) {
  const videoRef = React.useRef<HTMLVideoElement>(null)

  React.useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    if (src.includes('.m3u8')) {
      // HLS stream — use HLS.js
      import('hls.js').then(({ default: Hls }) => {
        if (Hls.isSupported()) {
          const hls = new Hls()
          hls.loadSource(src)
          hls.attachMedia(video)
          hls.on(Hls.Events.MANIFEST_PARSED, () => video.play().catch(() => {}))
          return () => hls.destroy()
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = src
          video.play().catch(() => {})
        }
      })
    } else {
      video.src = src
      video.play().catch(() => {})
    }
  }, [src])

  return <video ref={videoRef} controls className={className} />
}

function AssetViewer({ token, shareSession, asset, permission, allowDownload, showVersions, parentPath, onBack }: AssetViewerProps) {
  // Use the same ReviewProvider as the project review page, but with shareToken
  // This gives us the same video player, image viewer, comment panel, etc.
  return (
    <div className="fixed inset-0 z-50">
      <ShareReviewScreen
        token={token}
        shareSession={shareSession}
        assetId={asset.id}
        assetName={asset.name}
        permission={permission}
        allowDownload={allowDownload}
        showVersions={showVersions}
        parentPath={parentPath}
        onBack={onBack}
      />
    </div>
  )
}

/** Lazy-imported review components to avoid circular deps */
export function ShareReviewScreen({
  token, shareSession, assetId, assetName, permission, allowDownload, showVersions, parentPath, onBack,
}: {
  token: string; shareSession?: string | null; assetId: string; assetName: string; permission: SharePermission; allowDownload: boolean; showVersions: boolean; parentPath?: string; onBack?: () => void
}) {
  const [ReviewProvider, setProvider] = React.useState<any>(null)
  const [VideoPlayer, setVideoPlayer] = React.useState<any>(null)
  const [ImageViewer, setImageViewer] = React.useState<any>(null)
  const [AudioPlayer, setAudioPlayer] = React.useState<any>(null)
  const [CommentPanel, setCommentPanel] = React.useState<any>(null)
  const [CommentInput, setCommentInput] = React.useState<any>(null)
  const [VersionSwitcher, setVersionSwitcher] = React.useState<any>(null)
  const [loaded, setLoaded] = React.useState(false)

  React.useEffect(() => {
    // Dynamic import to avoid SSR issues
    Promise.all([
      import('@/components/review/review-provider'),
      import('@/components/review/video-player'),
      import('@/components/review/image-viewer'),
      import('@/components/review/audio-player'),
      import('@/components/review/comment-panel'),
      import('@/components/review/comment-input'),
      import('@/components/review/version-switcher'),
    ]).then(([provider, video, image, audio, comments, input, versionSwitcher]) => {
      setProvider(() => provider.ReviewProvider)
      setVideoPlayer(() => video.VideoPlayer)
      setImageViewer(() => image.ImageViewer)
      setAudioPlayer(() => audio.AudioPlayer)
      setCommentPanel(() => comments.CommentPanel)
      setCommentInput(() => input.CommentInput)
      setVersionSwitcher(() => versionSwitcher.VersionSwitcher)
      setLoaded(true)
    })
  }, [])

  if (!loaded || !ReviewProvider) {
    return <div className="flex items-center justify-center h-screen bg-bg-primary"><Loader2 className="h-8 w-8 animate-spin text-text-tertiary" /></div>
  }

  return (
    <ReviewProvider assetId={assetId} shareToken={token} shareSession={shareSession}>
      <ShareReviewInner
        token={token}
        shareSession={shareSession}
        assetName={assetName}
        permission={permission}
        allowDownload={allowDownload}
        showVersions={showVersions}
        parentPath={parentPath}
        onBack={onBack}
        VideoPlayer={VideoPlayer}
        ImageViewer={ImageViewer}
        AudioPlayer={AudioPlayer}
        CommentPanel={CommentPanel}
        CommentInput={CommentInput}
        VersionSwitcher={VersionSwitcher}
      />
    </ReviewProvider>
  )
}

function ShareReviewInner({
  token, shareSession, assetName, permission, allowDownload, showVersions, parentPath, onBack,
  VideoPlayer, ImageViewer, AudioPlayer, CommentPanel, CommentInput, VersionSwitcher,
}: any) {
  const { asset, versions, isLoading, comments, refetchComments, addComment } = useReview()
  const { currentVersion, isDrawingMode, focusedCommentId } = useReviewStore()
  // On small screens the comments panel is part of the page flow, below the
  // media, rather than a hidden overlay. Desktop keeps the collapsible sidebar.
  const [sidebarOpen, setSidebarOpen] = React.useState(true)
  const mobileSplit = useMobileReviewSplit()
  const [activeTab, setActiveTab] = React.useState<'comments' | 'fields'>('comments')
  const [AnnotationOverlay, setAnnotationOverlay] = React.useState<any>(null)
  const [AnnotationCanvas, setAnnotationCanvas] = React.useState<any>(null)

  React.useEffect(() => {
    Promise.all([
      import('@/components/review/annotation-overlay'),
      import('@/components/review/annotation-canvas'),
    ]).then(([overlayMod, canvasMod]) => {
      setAnnotationOverlay(() => overlayMod.AnnotationOverlay)
      setAnnotationCanvas(() => canvasMod.AnnotationCanvas)
    })
  }, [])

  const canComment = permission === 'comment' || permission === 'approve'
  const versionReady = currentVersion?.processing_status === 'ready'

  // Guest identity flow for non-authenticated users
  const [guestIdentity, setGuestIdentity] = React.useState<{ name: string; email: string } | null>(null)
  const [showGuestPrompt, setShowGuestPrompt] = React.useState(false)
  const pendingCommentRef = React.useRef<{ body: string; timecodeStart?: number; timecodeEnd?: number; annotationData?: Record<string, unknown>; parentId?: string } | null>(null)
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem('ff_guest_identity')
      if (stored) setGuestIdentity(JSON.parse(stored))
    } catch {}
  }, [])
  const isLoggedIn = typeof window !== 'undefined' && !!localStorage.getItem('ff_access_token')

  const submitComment = React.useCallback(async (body: string, timecodeStart?: number, timecodeEnd?: number, annotationData?: Record<string, unknown>, parentId?: string) => {
    const payload: CreateCommentPayload = { body }
    if (currentVersion?.id) payload.version_id = currentVersion.id
    if (timecodeStart != null) payload.timecode_start = timecodeStart
    if (timecodeEnd != null) payload.timecode_end = timecodeEnd
    if (annotationData) payload.annotation = { drawing_data: annotationData }
    if (parentId) payload.parent_id = parentId
    await addComment(payload)
    refetchComments().catch(() => {})
  }, [addComment, currentVersion, refetchComments])

  const submitWithIdentity = React.useCallback(async (body: string, timecodeStart?: number, timecodeEnd?: number, annotationData?: Record<string, unknown>, parentId?: string) => {
    const hasAuth = !!localStorage.getItem('ff_access_token')
    const hasGuest = !!localStorage.getItem('ff_guest_identity')
    if (!hasAuth && !hasGuest) {
      pendingCommentRef.current = { body, timecodeStart, timecodeEnd, annotationData, parentId }
      setShowGuestPrompt(true)
      return
    }
    await submitComment(body, timecodeStart, timecodeEnd, annotationData, parentId)
  }, [submitComment])

  const handleGuestIdentitySave = React.useCallback(async (name: string, email: string) => {
    const identity = { name, email }
    setGuestIdentity(identity)
    localStorage.setItem('ff_guest_identity', JSON.stringify(identity))
    setShowGuestPrompt(false)

    // Auto-submit the pending comment
    if (pendingCommentRef.current) {
      const { body, timecodeStart, timecodeEnd, annotationData, parentId } = pendingCommentRef.current
      pendingCommentRef.current = null
      setTimeout(() => submitComment(body, timecodeStart, timecodeEnd, annotationData, parentId), 50)
    }
  }, [submitComment])

  if (isLoading || !asset) {
    return <div className="flex items-center justify-center h-screen bg-bg-primary"><Loader2 className="h-8 w-8 animate-spin text-text-tertiary" /></div>
  }

  return (
    <div className="flex flex-col h-[100dvh] bg-bg-primary text-text-primary">
      {/* Top bar — same style as project review */}
      <div className="flex items-center justify-between border-b border-border px-3 h-12 bg-bg-secondary shrink-0">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          {onBack && (
            <button onClick={onBack} className="flex items-center justify-center h-7 w-7 rounded-md text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-colors shrink-0">
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}
          <span className="text-[13px] font-medium text-text-primary truncate">
            {parentPath && <span className="text-text-secondary">{parentPath} <span className="px-1 text-text-tertiary">/</span></span>}
            {assetName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {showVersions && VersionSwitcher && versions.length > 0 && (
            <>
              <div className="md:hidden">
                <VersionSwitcher versions={versions} compact />
              </div>
              <div className="hidden md:block">
                <VersionSwitcher versions={versions} />
              </div>
            </>
          )}
          {allowDownload && (
            <button className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium text-text-inverse bg-accent hover:bg-accent-hover transition-colors" onClick={() => handleDownload(token, asset.id, shareSession)}>
              <Download className="h-3 w-3" /> Download
            </button>
          )}
          <button
            onClick={() => setSidebarOpen(v => !v)}
            className={cn(
              'mobile-touch-target flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-bg-hover',
              sidebarOpen ? 'text-accent hover:text-accent' : 'text-text-secondary hover:text-text-primary',
            )}
          >
            {mobileSplit.isMobile
              ? sidebarOpen ? <PanelBottomClose className="h-4 w-4" /> : <PanelBottomOpen className="h-4 w-4" />
              : sidebarOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Main: viewer + sidebar */}
      <div ref={mobileSplit.containerRef} className="relative flex flex-1 min-h-0 flex-col overflow-hidden md:flex-row">
        {/* Media viewer — reuses project components */}
        <div
          className={cn('flex min-h-[220px] flex-col bg-bg-primary overflow-hidden min-w-0 md:min-h-0 md:flex-1', sidebarOpen ? 'flex-none' : 'flex-1')}
          style={mobileSplit.isMobile && sidebarOpen ? { height: `${mobileSplit.mediaPercent}%` } : undefined}
        >
          {asset.asset_type === 'video' && versionReady && VideoPlayer ? (
            <VideoPlayer
              assetId={asset.id}
              comments={comments}
              className="flex-1"
              initialStreamUrl={(asset as any).stream_url}
              overlay={
                <>
                  {AnnotationOverlay && <AnnotationOverlay key={focusedCommentId ?? 'none'} />}
                  {isDrawingMode && AnnotationCanvas && <AnnotationCanvas />}
                </>
              }
            />
          ) : asset.asset_type === 'audio' && versionReady && AudioPlayer ? (
            <AudioPlayer asset={asset} version={currentVersion} comments={comments} className="flex-1" />
          ) : (asset.asset_type === 'image' || asset.asset_type === 'image_carousel') && versionReady && ImageViewer ? (
            <div className="relative flex-1 flex items-center justify-center p-4 overflow-hidden">
              <ImageViewer
                asset={asset}
                version={currentVersion}
                annotationCanvas={
                  <>
                    {AnnotationOverlay && <AnnotationOverlay key={focusedCommentId ?? 'none'} />}
                    {isDrawingMode && AnnotationCanvas && <AnnotationCanvas />}
                  </>
                }
              />
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-text-tertiary" />
            </div>
          )}
        </div>

        {sidebarOpen && (
          <div className="relative z-10 h-0 shrink-0 md:hidden">
            <div
              role="separator"
              aria-label="Resize media and comments"
              aria-orientation="horizontal"
              className="absolute -top-4 left-0 flex h-8 w-full touch-none cursor-row-resize items-center justify-center"
              onPointerDown={mobileSplit.onPointerDown}
              onPointerMove={mobileSplit.onPointerMove}
              onPointerUp={mobileSplit.onPointerUp}
              onPointerCancel={mobileSplit.onPointerCancel}
            >
              <span className="pointer-events-none flex h-3 w-8 items-center justify-center rounded-full bg-accent text-text-tertiary">
                <GripHorizontal className="h-2.5 w-3.5" />
              </span>
            </div>
          </div>
        )}

        {/* Right sidebar — reuses project comment panel */}
        {sidebarOpen && (
          <div
            className="w-full min-h-0 flex flex-col border-t border-border bg-bg-secondary shrink-0 md:w-[360px] md:min-h-0 md:border-t-0 md:border-l"
            style={mobileSplit.isMobile ? { height: `${100 - mobileSplit.mediaPercent}%` } : undefined}
          >
            <div className="px-4 pt-3 pb-2 shrink-0">
              <div className="flex items-center bg-bg-tertiary rounded-lg p-0.5">
                <button onClick={() => setActiveTab('comments')} className={`flex-1 py-1.5 text-[13px] font-medium rounded-md transition-all ${activeTab === 'comments' ? 'bg-bg-hover text-text-primary shadow-sm' : 'text-text-tertiary'}`}>
                  Comments
                </button>
                <button onClick={() => setActiveTab('fields')} className={`flex-1 py-1.5 text-[13px] font-medium rounded-md transition-all ${activeTab === 'fields' ? 'bg-bg-hover text-text-primary shadow-sm' : 'text-text-tertiary'}`}>
                  Fields
                </button>
              </div>
            </div>

            {activeTab === 'comments' && CommentPanel && (
              <>
                <CommentPanel
                  comments={comments}
                  onResolve={() => {}}
                  canManageComment={(comment: any) => !!getGuestCommentToken(token, comment.id)}
                  onUpdate={async (commentId: string, body: string) => {
                    const guestEditToken = getGuestCommentToken(token, commentId)
                    if (!guestEditToken) throw new Error('Not authorized to edit this comment')
                    const session = shareSession ? `?share_session=${encodeURIComponent(shareSession)}` : ''
                    const response = await fetch(`${API_URL}/share/${token}/comments/${commentId}${session}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json', 'X-Guest-Comment-Token': guestEditToken },
                      body: JSON.stringify({ body }),
                    })
                    if (!response.ok) throw new Error('Failed to edit comment')
                    await refetchComments()
                  }}
                  onDelete={async (commentId: string) => {
                    const guestEditToken = getGuestCommentToken(token, commentId)
                    if (!guestEditToken) throw new Error('Not authorized to delete this comment')
                    const session = shareSession ? `?share_session=${encodeURIComponent(shareSession)}` : ''
                    const response = await fetch(`${API_URL}/share/${token}/comments/${commentId}${session}`, {
                      method: 'DELETE',
                      headers: { 'X-Guest-Comment-Token': guestEditToken },
                    })
                    if (!response.ok) throw new Error('Failed to delete comment')
                    removeGuestCommentToken(token, commentId)
                    await refetchComments()
                  }}
                  onAddReaction={() => {}}
                  onRemoveReaction={() => {}}
                  onReply={() => {}}
                  onSubmitReply={async (parentId: string, body: string) => submitWithIdentity(body, undefined, undefined, undefined, parentId)}
                  disableAttachments
                />
                {permission === 'approve' && (
                  <ShareApprovalActions token={token} assetId={asset.id} shareSession={shareSession} />
                )}
                {canComment && CommentInput && (
                  <CommentInput
                    assetId={asset.id}
                    projectId=""
                    assetType={asset.asset_type}
                    onSubmit={async (body: string, timecodeStart?: number, timecodeEnd?: number, annotationData?: Record<string, unknown>, parentId?: string) => submitWithIdentity(body, timecodeStart, timecodeEnd, annotationData, parentId)}
                    allowAttachments={false}
                  />
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* Guest identity prompt */}
      {showGuestPrompt && (
        <GuestIdentityPrompt
          onSave={handleGuestIdentitySave}
          onCancel={() => { setShowGuestPrompt(false); pendingCommentRef.current = null }}
        />
      )}
    </div>
  )
}

function ShareApprovalActions({ token, assetId, shareSession }: { token: string; assetId: string; shareSession?: string | null }) {
  const [status, setStatus] = React.useState<'idle' | 'approved' | 'rejected'>('idle')
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const decide = async (decision: 'approved' | 'rejected') => {
    setLoading(true)
    setError(null)
    try {
      const session = shareSession ? `?share_session=${encodeURIComponent(shareSession)}` : ''
      const response = await fetch(`${API_URL}/share/${token}/${decision === 'approved' ? 'approve' : 'reject'}${session}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset_id: assetId }),
      })
      if (!response.ok) throw new Error('Failed to submit decision')
      setStatus(decision)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to submit decision')
    } finally {
      setLoading(false)
    }
  }

  if (status === 'approved') {
    return <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-green-500/20 bg-green-500/10 px-4 py-2"><CheckCircle2 className="h-4 w-4 text-green-400" /><span className="text-sm font-medium text-green-400">Approved</span></div>
  }
  if (status === 'rejected') {
    return <div className="mx-3 mb-2 flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2"><XCircle className="h-4 w-4 text-red-400" /><span className="text-sm font-medium text-red-400">Rejected</span></div>
  }

  return (
    <div className="flex gap-2 px-3 pb-2">
      {error && <span className="self-center text-xs text-red-400">{error}</span>}
      <button onClick={() => decide('rejected')} disabled={loading} className="flex-1 rounded-md border border-red-500/30 px-3 py-1.5 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50">Reject</button>
      <button onClick={() => decide('approved')} disabled={loading} className="flex-1 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-text-inverse hover:bg-accent-hover disabled:opacity-50">Approve</button>
    </div>
  )
}

// ─── Guest Identity Prompt ───────────────────────────────────────────────────

function GuestIdentityPrompt({ onSave, onCancel }: { onSave: (name: string, email: string) => void; onCancel: () => void }) {
  const [name, setName] = React.useState('')
  const [email, setEmail] = React.useState('')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-border bg-bg-secondary p-5 shadow-xl">
        <h3 className="text-sm font-semibold text-text-primary mb-1">Leave a comment</h3>
        <p className="text-xs text-text-tertiary mb-4">Enter your name and email to comment on this shared asset.</p>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent"
            autoFocus
          />
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-border bg-bg-tertiary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent"
          />
        </div>
        <div className="flex items-center justify-end gap-2 mt-4">
          <button onClick={onCancel} className="px-3 py-1.5 text-xs text-text-tertiary hover:text-text-primary transition-colors">
            Cancel
          </button>
          <button
            disabled={!name.trim() || !email.trim()}
            onClick={() => onSave(name.trim(), email.trim())}
            className="px-4 py-1.5 rounded-md bg-accent text-xs font-medium text-text-inverse hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            Continue
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function FolderShareViewer({
  token,
  shareSession,
  folderName,
  title,
  description,
  createdByName,
  createdByAvatarUrl,
  viewerName,
  permission,
  allowDownload,
  showVersions,
  appearance,
  branding,
  onAssetClick,
  embedded = false,
  editableHeader = false,
  onTitleCommit,
  onDescriptionCommit,
}: FolderShareViewerProps) {
  // Build share_session query param for all API calls
  const sessionParam = shareSession ? `&share_session=${encodeURIComponent(shareSession)}` : ''
  const [currentSubfolderId, setCurrentSubfolderId] = React.useState<string | null>(null)
  const [breadcrumbs, setBreadcrumbs] = React.useState<{ id: string; name: string }[]>([])
  const [searchQuery, setSearchQuery] = React.useState('')
  const [foldersExpanded, setFoldersExpanded] = React.useState(true)
  const [assetsExpanded, setAssetsExpanded] = React.useState(true)
  const [panelOpen, setPanelOpen] = React.useState(false)
  const [viewingAsset, setViewingAsset] = React.useState<FolderShareAssetItem | null>(null)
  const headerAppearance = {
    key: appearance.header_banner_key,
    url: appearance.header_banner_url ?? null,
    positionX: appearance.header_banner_position_x ?? 50,
    positionY: appearance.header_banner_position_y ?? 50,
    zoom: appearance.header_banner_zoom ?? 1,
  }

  // The embedded preview must not replace the dashboard's browser title.
  React.useEffect(() => {
    if (embedded) return
    document.title = title ? `${title} – FreeFrame` : 'FreeFrame'
    return () => { document.title = 'FreeFrame' }
  }, [embedded, title])
  const [selectedAsset, setSelectedAsset] = React.useState<FolderShareAssetItem | null>(null)

  const [assets, setAssets] = React.useState<FolderShareAssetItem[]>([])
  const [subfolders, setSubfolders] = React.useState<FolderShareSubfolder[]>([])
  const [total, setTotal] = React.useState(0)
  const [page, setPage] = React.useState(1)
  const [loading, setLoading] = React.useState(true)
  const [loadingMore, setLoadingMore] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const accentColor = appearance.accent_color ?? branding?.primary_color ?? '#6366f1'
  const isDark = appearance.theme !== 'light'
  const previewThemeStyle = React.useMemo(() => ({
    '--accent': accentColor,
    '--accent-hover': `color-mix(in srgb, ${accentColor} 82%, ${isDark ? 'white' : 'black'})`,
    '--accent-muted': `color-mix(in srgb, ${accentColor} 22%, transparent)`,
    '--border-focus': accentColor,
  }) as React.CSSProperties, [accentColor, isDark])
  const cardSize = appearance.card_size ?? 'm'
  const aspectRatio = appearance.aspect_ratio ?? 'landscape'
  const thumbnailScale = appearance.thumbnail_scale ?? 'fill'
  const showCardInfo = appearance.show_card_info !== false
  const isGridLayout = appearance.layout !== 'list'
  const perPage = 24

  // Grid column classes based on card_size
  const gridCols = cardSize === 's'
    ? 'grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-7'
    : cardSize === 'l'
    ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
    : 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5'

  // Aspect ratio class
  const aspectClass = aspectRatio === 'square'
    ? 'aspect-square'
    : aspectRatio === 'portrait'
    ? 'aspect-[3/4]'
    : 'aspect-[16/10]'

  // Whether clicking opens viewer
  const openInViewer = appearance.open_in_viewer !== false

  // Compute total size of assets
  const totalAssetSize = React.useMemo(() => {
    const sum = assets.reduce((acc, a) => acc + (a.file_size ?? 0), 0)
    return sum > 0 ? formatFileSize(sum) : null
  }, [assets])

  // Compute total size of subfolders (approximate from asset sizes)
  const totalFolderSize = React.useMemo(() => {
    // We don't have individual subfolder sizes from the API,
    // just show item count info instead
    return null
  }, [])

  // Fetch assets for current folder/page
  React.useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setPage(1)
    setAssets([])
    setSubfolders([])
    setSelectedAsset(null)

    fetch(
      `${API_URL}/share/${token}/assets?${currentSubfolderId ? `folder_id=${currentSubfolderId}&` : ''}page=1&per_page=${perPage}${sessionParam}`,
    )
      .then((r) => {
        if (!r.ok) throw new Error('Failed to load assets')
        return r.json() as Promise<FolderShareAssetsResponse>
      })
      .then((data) => {
        if (cancelled) return
        setAssets(data.assets ?? [])
        setSubfolders(data.subfolders ?? [])
        setTotal(data.total ?? 0)
        setPage(1)
      })
      .catch(() => {
        if (!cancelled) setError('Failed to load contents')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [token, currentSubfolderId])

  async function loadMore() {
    const nextPage = page + 1
    setLoadingMore(true)
    try {
      const r = await fetch(
        `${API_URL}/share/${token}/assets?${currentSubfolderId ? `folder_id=${currentSubfolderId}&` : ''}page=${nextPage}&per_page=${perPage}${sessionParam}`,
      )
      if (!r.ok) throw new Error('Failed to load more')
      const data = (await r.json()) as FolderShareAssetsResponse
      setAssets((prev) => [...prev, ...(data.assets ?? [])])
      setPage(nextPage)
    } catch {
      // silently fail
    } finally {
      setLoadingMore(false)
    }
  }

  function navigateToSubfolder(subfolder: FolderShareSubfolder) {
    setBreadcrumbs((prev) => [...prev, { id: subfolder.id, name: subfolder.name }])
    setCurrentSubfolderId(subfolder.id)
    setSearchQuery('')
  }

  function navigateToBreadcrumb(index: number) {
    if (index === -1) {
      setBreadcrumbs([])
      setCurrentSubfolderId(null)
    } else {
      const crumb = breadcrumbs[index]
      setBreadcrumbs((prev) => prev.slice(0, index + 1))
      setCurrentSubfolderId(crumb.id)
    }
    setSearchQuery('')
  }

  // Client-side search filter + sort
  const sortBy = appearance.sort_by ?? 'created_at'
  const filteredAssets = React.useMemo(() => {
    const list = searchQuery.trim()
      ? assets.filter((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
      : [...assets]
    list.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      if (sortBy === 'file_size') return (b.file_size ?? 0) - (a.file_size ?? 0)
      // default: created_at desc
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    return list
  }, [assets, searchQuery, sortBy])

  const filteredSubfolders = searchQuery.trim()
    ? subfolders.filter((f) => f.name.toLowerCase().includes(searchQuery.toLowerCase().trim()))
    : subfolders

  const hasMore = assets.length < total && !searchQuery.trim()

  // Summary text
  const summaryParts: string[] = []
  if (subfolders.length > 0) {
    summaryParts.push(`${subfolders.length} Folder${subfolders.length === 1 ? '' : 's'}`)
  }
  if (assets.length > 0) {
    summaryParts.push(`${assets.length} Asset${assets.length === 1 ? '' : 's'}`)
  }
  const summaryText = summaryParts.join(', ')

  const locationItems = [
    { id: null as string | null, name: title || folderName },
    ...breadcrumbs,
  ]
  const assetParentPath = locationItems.map((item) => item.name).join(' / ')


  // Asset viewer overlay
  if (viewingAsset) {
    return (
      <div
        data-theme={isDark ? 'dark' : 'light'}
        style={previewThemeStyle}
        className={cn('bg-bg-primary text-text-primary', embedded ? 'h-full min-h-0' : 'min-h-screen')}
      >
        <AssetViewer
          token={token}
          shareSession={shareSession}
          asset={viewingAsset}
          permission={permission}
          allowDownload={allowDownload}
          showVersions={showVersions}
          parentPath={assetParentPath}
          onBack={() => setViewingAsset(null)}
        />
      </div>
    )
  }

  return (
    <div
      data-theme={isDark ? 'dark' : 'light'}
      style={previewThemeStyle}
      className={cn('flex flex-col bg-bg-primary text-text-primary', embedded ? 'h-full min-h-0 w-full' : 'flex-1 min-h-screen')}
    >
      {/* ─── Top Bar (Frame.io style) ─────────────────────────────────── */}
      <header className="flex items-center justify-between border-b border-border px-4 h-12 bg-bg-secondary shrink-0">
        {/* Left: viewer profile + breadcrumb */}
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {/* Viewer avatar (logged-in user) or project avatar */}
          {createdByAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={createdByAvatarUrl}
              alt={createdByName ? `Profile photo of ${createdByName}` : ''}
              className="h-7 w-7 rounded-full object-cover shrink-0"
            />
          ) : viewerName ? (
            <div className="relative group shrink-0">
              <button className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-text-primary bg-green-600 hover:ring-2 hover:ring-green-400/50 transition-all">
                {viewerName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()}
              </button>
              {/* Dropdown */}
              <div className="hidden group-hover:block absolute left-0 top-full mt-1 z-50 w-56 rounded-lg border border-border bg-bg-elevated shadow-xl py-1">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-sm font-medium text-text-primary">{viewerName}</p>
                </div>
                <button
                  onClick={() => {
                    // Ensure cookie is set from localStorage before navigating
                    if (typeof window !== 'undefined') {
                      const token = localStorage.getItem('ff_access_token')
                      if (token) {
                        document.cookie = `ff_access_token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
                      }
                      window.location.href = '/projects'
                    }
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-text-primary hover:bg-bg-tertiary transition-colors"
                >
                  Back to Dashboard
                </button>
                <button
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      localStorage.removeItem('ff_access_token')
                      localStorage.removeItem('ff_refresh_token')
                      document.cookie = 'ff_access_token=; path=/; max-age=0'
                      window.location.href = '/login'
                    }
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  Log out
                </button>
              </div>
            </div>
          ) : branding?.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logo_url}
              alt=""
              className="h-7 w-7 rounded-full object-cover shrink-0"
            />
          ) : (
            <div
              className="flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-text-primary shrink-0"
              style={{ backgroundColor: accentColor }}
            >
              {(branding?.custom_title ?? folderName ?? 'FF').substring(0, 2).toUpperCase()}
            </div>
          )}

          {/* Location breadcrumb */}
          <nav className="flex min-w-0 items-center text-[13px] font-medium">
            {locationItems.map((item, index) => {
              const isCurrent = index === locationItems.length - 1
              return (
                <React.Fragment key={item.id ?? 'root'}>
                  {index > 0 && <span className="px-1.5 text-text-tertiary">/</span>}
                  <button
                    onClick={() => !isCurrent && navigateToBreadcrumb(index - 1)}
                    className={cn(
                      'truncate',
                      isCurrent
                        ? 'pointer-events-none text-text-primary'
                        : 'text-text-secondary hover:text-text-primary hover:underline',
                    )}
                  >
                    {item.name}
                  </button>
                </React.Fragment>
              )
            })}
          </nav>
        </div>

        {/* Right: Download All + panel toggle */}
        <div className="flex items-center gap-2 shrink-0">
          {allowDownload && (
            <button
              className="flex items-center gap-1.5 h-7 px-3 rounded-md text-xs font-medium text-text-inverse bg-accent hover:bg-accent-hover transition-colors"
              onClick={() => handleDownloadAll(token, currentSubfolderId ?? null, shareSession)}
            >
              <Download className="h-3 w-3" />
              Download All
            </button>
          )}
            <button
              onClick={() => setPanelOpen((v) => !v)}
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-md transition-colors hover:bg-bg-hover',
                panelOpen ? 'text-accent hover:text-accent' : 'text-text-secondary hover:text-text-primary',
              )}
              title={panelOpen ? 'Hide panel' : 'Show panel'}
          >
            {panelOpen ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
          </button>
        </div>
      </header>

      {/* ─── Content area ──────────────────────────────────────────────── */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* ─── Left: folder contents ─────────────────────────────────── */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Sub-header: title, summary, breadcrumb, search */}
          <div>
            {breadcrumbs.length === 0 && headerAppearance.url ? (
              <div className="relative mb-4 aspect-[16/4] min-h-24 overflow-hidden bg-bg-tertiary sm:min-h-28">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={headerAppearance.url}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-150"
                  style={{
                    objectPosition: `${headerAppearance.positionX}% ${headerAppearance.positionY}%`,
                    transform: `scale(${headerAppearance.zoom})`,
                    transformOrigin: `${headerAppearance.positionX}% ${headerAppearance.positionY}%`,
                  }}
                />
                <div
                  className={cn(
                    'absolute inset-0 bg-gradient-to-t',
                    isDark
                      ? 'from-bg-primary via-bg-primary/65 to-black/10'
                      : 'from-bg-primary via-bg-primary/80 to-bg-primary/10',
                  )}
                />
                <div className="absolute inset-x-0 bottom-0 p-4 sm:p-5">
                  <EditableShareTitle
                    value={title || folderName}
                    editable={editableHeader}
                    onCommit={onTitleCommit}
                    className="text-2xl font-bold leading-tight text-text-primary sm:text-3xl"
                  />
                  {!loading && (
                    <p className="mt-1.5 text-xs text-text-secondary">
                      {createdByName && <>Created by {createdByName} &middot; </>}
                      {summaryText || 'Empty folder'}
                    </p>
                  )}
                  <EditableShareDescription
                    value={description}
                    editable={editableHeader}
                    onCommit={onDescriptionCommit}
                    className="mt-1 max-w-2xl line-clamp-2 text-sm text-text-secondary"
                  />
                </div>
              </div>
            ) : (
              <div className="relative px-5 pt-4">
                <EditableShareTitle
                  value={title || folderName}
                  editable={editableHeader}
                  onCommit={onTitleCommit}
                  className="text-lg font-bold leading-tight text-text-primary"
                />
                <EditableShareDescription
                  value={description}
                  editable={editableHeader}
                  onCommit={onDescriptionCommit}
                  className="mt-1 text-sm text-text-secondary line-clamp-2"
                />
              </div>
            )}
            {!loading && !headerAppearance.url && (
              <div className="px-5 pt-3">
              <p className="mt-0.5 text-sm text-text-tertiary">
                {createdByName && <>Created by {createdByName} &middot; </>}
                {summaryText || 'Empty folder'}
              </p>
              </div>
            )}
          </div>

          {/* Main scrollable content */}
          <div className="flex-1 overflow-y-auto px-5 pb-5 pt-0">
            {loading ? (
              <div className="flex items-center justify-center py-24">
                <Loader2 className="h-8 w-8 animate-spin text-text-tertiary" />
              </div>
            ) : error ? (
              <div className="flex items-center justify-center py-24">
                <p className="text-sm text-text-tertiary">{error}</p>
              </div>
            ) : filteredSubfolders.length === 0 && filteredAssets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <Folder className="h-12 w-12 text-text-tertiary" />
                <p className="text-sm text-text-tertiary">
                  {searchQuery.trim() ? 'No results found' : 'This folder is empty'}
                </p>
              </div>
            ) : (
              <>
                {/* Subfolders section */}
                {filteredSubfolders.length > 0 && (
                  <section className="mb-6">
                    <SectionHeader
                      label={filteredSubfolders.length === 1 ? 'Folder' : 'Folders'}
                      count={filteredSubfolders.length}
                      totalSize={totalFolderSize}
                      expanded={foldersExpanded}
                      onToggle={() => setFoldersExpanded((v) => !v)}
                    />
                    {foldersExpanded && (
                      <div className={cn('grid gap-3 mt-2', gridCols)}>
                        {filteredSubfolders.map((subfolder) => (
                          <SubfolderCard
                            key={subfolder.id}
                            subfolder={subfolder}
                            onClick={navigateToSubfolder}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* Assets section */}
                {filteredAssets.length > 0 && (
                  <section>
                    <SectionHeader
                      label={filteredAssets.length === 1 ? 'Asset' : 'Assets'}
                      count={filteredAssets.length}
                      totalSize={totalAssetSize}
                      expanded={assetsExpanded}
                      onToggle={() => setAssetsExpanded((v) => !v)}
                      actions={
                        <div className="relative">
                          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-tertiary" />
                          <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search assets…"
                            aria-label="Search assets"
                            className="h-8 w-52 rounded-md border border-border bg-bg-tertiary pl-8 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-border-focus focus:outline-none"
                          />
                        </div>
                      }
                    />

                    {assetsExpanded && (
                      <>
                        {isGridLayout ? (
                          <div className={cn('grid gap-3 mt-2', gridCols)}>
                            {filteredAssets.map((asset) => (
                              <AssetGridCard
                                key={asset.id}
                                asset={asset}
                                allowDownload={allowDownload}
                                token={token}
                                shareSession={shareSession}
                                isSelected={selectedAsset?.id === asset.id}
                                onSelect={setSelectedAsset}
                                onOpen={openInViewer ? setViewingAsset : () => {}}
                                aspectClass={aspectClass}
                                thumbnailScale={thumbnailScale}
                                showCardInfo={showCardInfo}
                                accentColor={accentColor}
                              />
                            ))}
                          </div>
                        ) : (
                          <div className="mt-2 rounded-lg border border-border overflow-hidden">
                            {/* Column headers */}
                            <div className="flex items-center gap-4 px-1 py-2 border-b border-border bg-bg-secondary/50 text-[10px] text-text-tertiary font-medium uppercase tracking-wider">
                              <div className="h-14 w-14 shrink-0" />
                              <div className="flex-1 min-w-0">Name</div>
                              <div className="hidden sm:block w-24 text-right shrink-0">Size</div>
                              <div className="hidden sm:block w-28 shrink-0">Date</div>
                              {allowDownload && <div className="w-7 shrink-0" />}
                            </div>
                            {filteredAssets.map((asset, i) => {
                              const TypeIcon = getAssetTypeIcon(asset.asset_type)
                              return (
                                <div
                                  key={asset.id}
                                  className={cn(
                                    'group flex items-center gap-4 py-2 px-1 cursor-pointer transition-colors hover:bg-bg-hover',
                                    selectedAsset?.id === asset.id && 'bg-accent/5',
                                    i !== filteredAssets.length - 1 && 'border-b border-border',
                                  )}
                                  onClick={() => setSelectedAsset(asset)}
                                  onDoubleClick={() => openInViewer && setViewingAsset(asset)}
                                  onPointerUp={(event) => {
                                    if (event.pointerType === 'touch' && openInViewer) setViewingAsset(asset)
                                  }}
                                >
                                  {/* Square thumbnail */}
                                  <ListRowThumb asset={asset} TypeIcon={TypeIcon} />
                                  {/* Name + meta */}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-text-primary truncate leading-snug">{asset.name}</p>
                                    <p className="text-xs text-text-tertiary mt-0.5 truncate">
                                      {asset.created_by_name && <>{asset.created_by_name} &middot; </>}
                                      {formatShortDate(asset.created_at)}
                                    </p>
                                  </div>
                                  {/* File size */}
                                  <span className="hidden sm:block w-24 text-right text-sm text-text-tertiary tabular-nums shrink-0">
                                    {asset.file_size != null ? formatFileSize(asset.file_size) : '—'}
                                  </span>
                                  {/* Date */}
                                  <span className="hidden sm:block w-28 text-xs text-text-tertiary shrink-0">
                                    {formatDate(asset.created_at)}
                                  </span>
                                  {/* Download */}
                                  {allowDownload && (
                                    <button
                                      className="w-7 shrink-0 flex items-center justify-center h-7 rounded text-text-tertiary opacity-0 group-hover:opacity-100 hover:text-text-primary transition-all"
                                      onClick={(e) => { e.stopPropagation(); handleDownload(token, asset.id, shareSession) }}
                                      onPointerUp={(e) => e.stopPropagation()}
                                      title="Download"
                                    >
                                      <Download className="h-4 w-4" />
                                    </button>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}

                        {/* Load more */}
                        {hasMore && (
                          <div className="flex justify-center mt-6">
                            <button
                              onClick={loadMore}
                              disabled={loadingMore}
                              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium border border-border text-text-primary hover:bg-bg-tertiary hover:border-border-focus disabled:opacity-50 transition-colors"
                            >
                              {loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}
                              {loadingMore ? 'Loading…' : 'Load more'}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </section>
                )}
              </>
            )}
          </div>

        </div>

        {/* ─── Right Panel ───────────────────────────────────────────── */}
        {panelOpen && (
          <div className="w-full md:w-[320px] absolute inset-y-0 right-0 z-20 md:static md:inset-auto flex flex-col border-l-0 md:border-l border-border bg-bg-secondary shrink-0 overflow-hidden">
            <RightPanel
              selectedAsset={selectedAsset}
              token={token}
              permission={permission}
              allowDownload={allowDownload}
              onOpenAsset={setViewingAsset}
            />
          </div>
        )}
      </div>
    </div>
  )
}
