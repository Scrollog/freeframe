import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/api', () => ({
  api: { post: vi.fn(), get: vi.fn() },
}))

import { api } from '@/lib/api'
import { useUploadStore } from '../upload-store'

const ASSET_ID = 'asset-1'
const VERSION_ID = 'version-2'
const PREVIOUS_VERSION_ID = 'version-1'

function makeFile(): File {
  return new File([new Uint8Array(1024)], 'clip.mp4', { type: 'video/mp4' })
}

function mockUploadWithLostCompletion(): { aborts: unknown[] } {
  const aborts: unknown[] = []
  vi.mocked(api.post).mockImplementation((path: string, body?: unknown) => {
    if (path === '/upload/initiate' || path === `/assets/${ASSET_ID}/versions`) {
      return Promise.resolve({
        upload_id: 'upload-1',
        s3_key: 'raw/project/asset/version/original.mp4',
        asset_id: ASSET_ID,
        version_id: VERSION_ID,
      }) as never
    }
    if (path === '/upload/presign-part') {
      return Promise.resolve({ presigned_url: 'https://storage.example/part-1' }) as never
    }
    if (path === '/upload/complete') {
      return Promise.reject(new Error('Failed to fetch')) as never
    }
    if (path === '/upload/abort') {
      aborts.push(body)
      return Promise.resolve({}) as never
    }
    return Promise.resolve({}) as never
  })
  return { aborts }
}

function mockAssetRead(versionId: string | null, processingStatus: string) {
  vi.mocked(api.get).mockResolvedValue({
    id: ASSET_ID,
    latest_version: versionId ? { id: versionId, processing_status: processingStatus } : null,
  } as never)
}

function rowOf(id: string) {
  return useUploadStore.getState().files.find((file) => file.id === id)!
}

async function waitForCompletionAttempt() {
  await vi.waitFor(() => expect(api.post).toHaveBeenCalledWith(
    '/upload/complete',
    expect.anything(),
  ))
}

describe('lost upload completion responses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    useUploadStore.setState({ files: [] })
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: () => '"etag-1"' },
    }) as never
  })

  it('keeps a new upload processing when the server already accepted completion', async () => {
    const { aborts } = mockUploadWithLostCompletion()
    mockAssetRead(VERSION_ID, 'processing')

    const id = useUploadStore.getState().startUpload(makeFile(), 'project-1', 'clip')
    await waitForCompletionAttempt()
    await vi.waitFor(() => expect(rowOf(id).status).toBe('processing'))

    expect(aborts).toEqual([])
  })

  it('shows complete when processing finished before recovery reads the version', async () => {
    const { aborts } = mockUploadWithLostCompletion()
    mockAssetRead(VERSION_ID, 'ready')

    const id = useUploadStore.getState().startUpload(makeFile(), 'project-1', 'clip')
    await waitForCompletionAttempt()
    await vi.waitFor(() => expect(rowOf(id).status).toBe('complete'))

    expect(aborts).toEqual([])
  })

  it('does not confuse an older ready version with the newly uploaded version', async () => {
    const { aborts } = mockUploadWithLostCompletion()
    mockAssetRead(PREVIOUS_VERSION_ID, 'ready')

    const id = useUploadStore.getState().startUpload(makeFile(), 'project-1', 'clip')
    await waitForCompletionAttempt()
    await vi.waitFor(() => expect(rowOf(id).status).toBe('failed'))
    await vi.waitFor(() => expect(aborts).toHaveLength(1))
  })

  it('uses the same recovery path for a newly uploaded version', async () => {
    const { aborts } = mockUploadWithLostCompletion()
    mockAssetRead(VERSION_ID, 'processing')

    const id = useUploadStore.getState().startVersionUpload(
      makeFile(), ASSET_ID, 'clip', 'project-1',
    )
    await waitForCompletionAttempt()
    await vi.waitFor(() => expect(rowOf(id).status).toBe('processing'))

    expect(aborts).toEqual([])
  })

  it('still marks a genuine completion failure as failed and aborts it', async () => {
    const { aborts } = mockUploadWithLostCompletion()
    vi.mocked(api.get).mockRejectedValue(new Error('Failed to fetch'))

    const id = useUploadStore.getState().startUpload(makeFile(), 'project-1', 'clip')
    await waitForCompletionAttempt()
    await vi.waitFor(() => expect(rowOf(id).status).toBe('failed'))
    await vi.waitFor(() => expect(aborts).toHaveLength(1))
  })

  it('does not overwrite a cancellation made while recovery is reading the version', async () => {
    mockUploadWithLostCompletion()
    let releaseRead: ((asset: unknown) => void) | undefined
    vi.mocked(api.get).mockImplementation(() => new Promise((resolve) => {
      releaseRead = resolve
    }) as never)

    const id = useUploadStore.getState().startUpload(makeFile(), 'project-1', 'clip')
    await vi.waitFor(() => expect(api.get).toHaveBeenCalledTimes(1))

    useUploadStore.getState().cancelUpload(id)
    releaseRead?.({
      id: ASSET_ID,
      latest_version: { id: VERSION_ID, processing_status: 'processing' },
    })

    await vi.waitFor(() => expect(rowOf(id).status).toBe('cancelled'))
  })
})
