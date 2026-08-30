'use client'

import * as React from 'react'
import { createPortal } from 'react-dom'
import { FileText, Film, ImageIcon, Download, Trash2, Loader2, X } from 'lucide-react'
import { cn, formatBytes } from '@/lib/utils'
import type { CommentAttachment as CommentAttachmentType } from '@/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface CommentAttachmentProps {
  attachment: CommentAttachmentType
  /** S3 presigned URL for displaying/downloading */
  downloadUrl?: string
  isOwn?: boolean
  onDelete?: (attachmentId: string) => Promise<void>
  className?: string
}

// ─── File type icon helper ─────────────────────────────────────────────────────

function FileIcon({ contentType, className }: { contentType: string; className?: string }) {
  if (contentType.startsWith('image/')) return <ImageIcon className={cn('h-5 w-5', className)} />
  if (contentType.startsWith('video/')) return <Film className={cn('h-5 w-5', className)} />
  return <FileText className={cn('h-5 w-5', className)} />
}

// ─── Component ────────────────────────────────────────────────────────────────

export function CommentAttachment({
  attachment,
  downloadUrl,
  isOwn,
  onDelete,
  className,
}: CommentAttachmentProps) {
  const [deleting, setDeleting] = React.useState(false)
  const [imageError, setImageError] = React.useState(false)
  const [previewOpen, setPreviewOpen] = React.useState(false)

  async function handleDelete() {
    if (!onDelete) return
    setDeleting(true)
    try {
      await onDelete(attachment.id)
    } finally {
      setDeleting(false)
    }
  }

  const fileUrl = downloadUrl ?? attachment.url
  const isImage = attachment.content_type.startsWith('image/') && !imageError && fileUrl
  const isVideo = attachment.content_type.startsWith('video/') && fileUrl

  React.useEffect(() => {
    if (!previewOpen) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [previewOpen])

  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-lg border border-border bg-bg-secondary',
        className,
      )}
    >
      {/* Image preview */}
      {isImage && (
        <div className="relative">
          <button type="button" onClick={() => setPreviewOpen(true)} className="block w-full cursor-zoom-in" title="Open image preview">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fileUrl}
              alt={attachment.file_name}
              className="max-h-48 w-full object-cover transition-opacity hover:opacity-90"
              onError={() => setImageError(true)}
            />
          </button>
        </div>
      )}

      {/* Video preview */}
      {isVideo && !isImage && (
        <div className="relative bg-black">
          <video
            src={fileUrl}
            className="max-h-48 w-full object-contain"
            controls={false}
            preload="metadata"
          />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="rounded-full bg-black/60 p-3">
              <Film className="h-6 w-6 text-white" />
            </div>
          </div>
        </div>
      )}

      {/* File info row */}
      <div className="flex items-center gap-2 px-3 py-2">
        <div className="shrink-0 text-text-tertiary">
          <FileIcon contentType={attachment.content_type} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="truncate text-xs font-medium text-text-primary">
            {attachment.file_name}
          </p>
          <p className="text-2xs text-text-tertiary">
            {formatBytes(attachment.file_size)}
          </p>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {fileUrl && (
            <a
              href={fileUrl}
              download={attachment.file_name}
              className="inline-flex h-7 w-7 items-center justify-center rounded text-text-tertiary hover:bg-bg-hover hover:text-text-secondary transition-colors"
              title="Download"
            >
              <Download className="h-3.5 w-3.5" />
            </a>
          )}
          {isOwn && onDelete && (
            <button
              className="inline-flex h-7 w-7 items-center justify-center rounded text-text-tertiary hover:bg-bg-hover hover:text-status-error transition-colors disabled:opacity-50"
              onClick={handleDelete}
              disabled={deleting}
              title="Delete attachment"
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </button>
          )}
        </div>
      </div>
      {previewOpen && fileUrl && typeof document !== 'undefined' && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Preview of ${attachment.file_name}`}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-6"
          onMouseDown={() => setPreviewOpen(false)}
        >
          <button type="button" onClick={() => setPreviewOpen(false)} className="absolute right-5 top-5 flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Close image preview">
            <X className="h-5 w-5" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={fileUrl} alt={attachment.file_name} className="max-h-full max-w-full rounded-md object-contain" onMouseDown={(event) => event.stopPropagation()} />
        </div>,
        document.body,
      )}
    </div>
  )
}
