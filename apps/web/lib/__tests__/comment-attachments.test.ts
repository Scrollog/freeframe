import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  post: vi.fn(),
  remove: vi.fn(),
}))

vi.mock('@/lib/api', () => ({
  api: { post: mocks.post, delete: mocks.remove },
}))

import { submitCommentWithAttachment, uploadCommentAttachment, validateCommentAttachment } from '../comment-attachments'

describe('comment attachments', () => {
  beforeEach(() => {
    mocks.post.mockReset()
    mocks.remove.mockReset()
    vi.stubGlobal('fetch', vi.fn())
  })

  it('rejects empty and oversized files before creating an upload', () => {
    const oversized = new File(['large'], 'large.bin')
    Object.defineProperty(oversized, 'size', { value: 101 * 1024 * 1024 })
    expect(validateCommentAttachment(new File([], 'empty.txt'))).toMatch(/empty/i)
    expect(validateCommentAttachment(oversized)).toMatch(/100 MB/)
  })

  it('creates an attachment record and uploads the selected file', async () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    mocks.post.mockResolvedValue({ upload_url: 'https://uploads.example.test/file', attachment_id: 'attachment-1' })
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 200 }))

    await uploadCommentAttachment('comment-1', file)

    expect(mocks.post).toHaveBeenCalledWith('/comments/comment-1/attachments', {
      file_name: 'notes.txt', file_size: file.size, content_type: 'text/plain',
    })
    expect(fetch).toHaveBeenCalledWith('https://uploads.example.test/file', expect.objectContaining({ method: 'PUT', body: file }))
  })

  it('retries an attachment against the existing comment without creating a duplicate', async () => {
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' })
    const createComment = vi.fn()
    mocks.post.mockResolvedValue({ upload_url: 'https://uploads.example.test/file', attachment_id: 'attachment-1' })
    vi.mocked(fetch).mockResolvedValue(new Response('', { status: 200 }))

    await submitCommentWithAttachment('comment-1', file, createComment)

    expect(createComment).not.toHaveBeenCalled()
    expect(mocks.post).toHaveBeenCalledWith('/comments/comment-1/attachments', expect.any(Object))
  })
})
