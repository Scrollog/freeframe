import { api } from '@/lib/api'

const MAX_ATTACHMENT_SIZE = 100 * 1024 * 1024

interface AttachmentUploadResponse {
  upload_url: string
  attachment_id: string
}

export function validateCommentAttachment(file: File): string | null {
  if (file.size === 0) return 'The selected file is empty.'
  if (file.size > MAX_ATTACHMENT_SIZE) return 'Attachments must be 100 MB or smaller.'
  return null
}

export async function uploadCommentAttachment(commentId: string, file: File): Promise<void> {
  const contentType = file.type || 'application/octet-stream'
  const upload = await api.post<AttachmentUploadResponse>(`/comments/${commentId}/attachments`, {
    file_name: file.name,
    file_size: file.size,
    content_type: contentType,
  })

  try {
    const response = await fetch(upload.upload_url, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file,
    })
    if (!response.ok) throw new Error('Could not upload the attachment.')
  } catch (error) {
    await api.delete(`/comments/${commentId}/attachments/${upload.attachment_id}`).catch(() => undefined)
    throw error
  }
}

/**
 * Creates a comment once and retries only its attachment upload if the storage
 * request fails. Both the main composer and inline replies use this flow.
 */
export async function submitCommentWithAttachment(
  existingCommentId: string | null,
  attachment: File | null,
  createComment: () => Promise<{ id: string } | void>,
  onAttachmentsUploaded?: () => void,
): Promise<string | null> {
  let commentId = existingCommentId
  if (!commentId) {
    const comment = await createComment()
    commentId = comment?.id ?? null
    if (attachment && !commentId) {
      throw new Error('This comment cannot accept attachments.')
    }
  }

  if (attachment && commentId) {
    await uploadCommentAttachment(commentId, attachment)
    onAttachmentsUploaded?.()
  }

  return commentId
}
