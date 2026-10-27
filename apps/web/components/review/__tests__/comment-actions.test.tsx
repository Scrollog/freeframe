import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useReviewStore } from '@/stores/review-store'
import { CommentPanel } from '../comment-panel'

beforeEach(() => {
  useReviewStore.getState().reset()
  Element.prototype.scrollIntoView = vi.fn()
})

const noop = async () => {}

function renderOwnComment(onUpdate = noop, onDelete = noop) {
  return render(
    <CommentPanel
      comments={[{
        id: 'c1', asset_id: 'a1', version_id: 'v1', parent_id: null, author_id: 'u1',
        author: { id: 'u1', name: 'Maya Chen', avatar_url: null }, guest_author: null,
        body: 'Original text', timecode_start: null, timecode_end: null, resolved: false,
        visibility: 'public', created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        replies: [], reactions: [], attachments: [], annotation: null,
      }] as never}
      currentUserId="u1"
      onResolve={noop} onUpdate={onUpdate} onDelete={onDelete}
      onAddReaction={noop} onRemoveReaction={noop} onReply={() => {}}
    />,
  )
}

function openCommentActions() {
  fireEvent.pointerDown(screen.getByLabelText('Comment actions'), { button: 0, ctrlKey: false })
}

describe('CommentPanel comment actions', () => {
  it('saves an edit through the supplied comment mutation', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined)
    renderOwnComment(onUpdate)

    openCommentActions()
    fireEvent.click(await screen.findByText('Edit'))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Updated text' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(onUpdate).toHaveBeenCalledWith('c1', 'Updated text'))
  })

  it('deletes through the supplied comment mutation', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined)
    renderOwnComment(noop, onDelete)

    openCommentActions()
    fireEvent.click(await screen.findByText('Delete'))

    await waitFor(() => expect(onDelete).toHaveBeenCalledWith('c1'))
  })
})
