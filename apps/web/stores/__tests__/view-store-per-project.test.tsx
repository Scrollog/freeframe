import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react'
import { useViewStore, VIEW_STORAGE_KEY } from '../view-store'
import { MAX_PROJECT_VIEWS, resolveProjectView } from '@/lib/project-view'
import { useProjectView } from '@/hooks/use-project-view'
import { SortPopover } from '@/components/projects/sort-popover'
import { AppearancePopover } from '@/components/projects/appearance-popover'

// A project's folder view keeps its own Appearance and sort: changing them in
// project A leaves project B (and My assets) alone, and A opens with them next
// time.

const GLOBAL = {
  layout: 'grid' as const,
  cardSize: 'M' as const,
  sortKey: 'date' as const,
  sortDirection: 'desc' as const,
  showCardInfo: true,
}

beforeEach(() => {
  window.localStorage.clear()
  useViewStore.setState({ ...GLOBAL, projectViews: {} })
})

const view = (projectId?: string | null) => resolveProjectView(useViewStore.getState(), projectId)

describe('per-project view settings', () => {
  it('sorting project A by name leaves project B and the global sort alone', () => {
    const { result: a } = renderHook(() => useProjectView('project-a'))
    act(() => a.current.setSortKey('name'))

    expect(view('project-a')).toMatchObject({ sortKey: 'name', sortDirection: 'asc' })
    expect(view('project-b')).toMatchObject({ sortKey: 'date', sortDirection: 'desc' })
    expect(useViewStore.getState().sortKey).toBe('date')
  })

  it('keeps Appearance per project too', () => {
    const { result: a } = renderHook(() => useProjectView('project-a'))
    act(() => {
      a.current.setLayout('list')
      a.current.setCardSize('L')
    })

    expect(view('project-a')).toMatchObject({ layout: 'list', cardSize: 'L' })
    expect(view('project-b')).toMatchObject({ layout: 'grid', cardSize: 'M' })
  })

  it('a project with nothing saved follows the global settings', () => {
    useViewStore.setState({ layout: 'list', sortKey: 'type', sortDirection: 'asc' })
    expect(view('fresh-project')).toMatchObject({ layout: 'list', sortKey: 'type' })
  })

  it("a project's first change copies the global settings, then stops following them", () => {
    const { result: a } = renderHook(() => useProjectView('project-a'))
    act(() => a.current.setSortKey('name'))

    // A later global change (My assets) must not leak into A's layout.
    useViewStore.setState({ layout: 'list' })
    expect(view('project-a').layout).toBe('grid')
  })

  it('without a project (My assets) the global settings are read and written', () => {
    for (const id of [undefined, null, '']) {
      const { result } = renderHook(() => useProjectView(id))
      act(() => result.current.setSortKey('status'))
      expect(useViewStore.getState().sortKey).toBe('status')
      useViewStore.setState({ sortKey: 'date' })
    }
    expect(useViewStore.getState().projectViews).toEqual({})
  })

  it('toggles the direction of the project sort only', () => {
    const { result: a } = renderHook(() => useProjectView('project-a'))
    act(() => a.current.toggleSortDirection())
    expect(view('project-a').sortDirection).toBe('asc')
    expect(useViewStore.getState().sortDirection).toBe('desc')
  })

  it('remembers the settings across a reload', async () => {
    useViewStore.getState().setProjectView('project-a', { sortKey: 'name', layout: 'list' })
    const saved = window.localStorage.getItem(VIEW_STORAGE_KEY) ?? '{}'
    expect(JSON.parse(saved).state.projectViews['project-a']).toMatchObject({ sortKey: 'name', layout: 'list' })

    // "Reload": forget the in-memory copy (which also rewrites storage), then
    // put back what the browser had and read it again.
    useViewStore.setState({ projectViews: {} })
    window.localStorage.setItem(VIEW_STORAGE_KEY, saved)
    await useViewStore.persist.rehydrate()
    expect(view('project-a')).toMatchObject({ sortKey: 'name', layout: 'list' })
  })

  it('reads a stored copy from before per-project settings', async () => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({
      state: { layout: 'list', sortKey: 'name', sortDirection: 'asc' },
      version: 0,
    }))
    await useViewStore.persist.rehydrate()
    expect(useViewStore.getState().projectViews).toEqual({})
    expect(view('project-a')).toMatchObject({ layout: 'list', sortKey: 'name' })
  })

  it('ignores damaged stored values', async () => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({
      state: { projectViews: { 'project-a': { layout: 'mosaic', sortKey: 'name', cardSize: 7 } } },
      version: 0,
    }))
    await useViewStore.persist.rehydrate()
    expect(view('project-a')).toMatchObject({ layout: 'grid', cardSize: 'M', sortKey: 'name' })

    window.localStorage.setItem(VIEW_STORAGE_KEY, JSON.stringify({
      state: { projectViews: 'nonsense' },
      version: 0,
    }))
    await useViewStore.persist.rehydrate()
    expect(useViewStore.getState().projectViews).toEqual({})
  })

  it('still applies a change when storage refuses to save it', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('full', 'QuotaExceededError')
    })
    try {
      expect(() => useViewStore.getState().setProjectView('project-a', { sortKey: 'name' })).not.toThrow()
      expect(view('project-a').sortKey).toBe('name')
    } finally {
      setItem.mockRestore()
    }
  })

  it('keeps at most MAX_PROJECT_VIEWS projects, dropping the least recently changed', () => {
    const { setProjectView } = useViewStore.getState()
    for (let i = 0; i <= MAX_PROJECT_VIEWS; i++) setProjectView(`p${i}`, { sortKey: 'name' })
    const ids = Object.keys(useViewStore.getState().projectViews)
    expect(ids).toHaveLength(MAX_PROJECT_VIEWS)
    expect(ids).not.toContain('p0')
    expect(ids).toContain(`p${MAX_PROJECT_VIEWS}`)
  })
})

describe('toolbar menus inside a project', () => {
  it('"Sorted by" changes only the project it is in', () => {
    render(<SortPopover projectId="project-a" />)
    fireEvent.click(screen.getByRole('button', { name: /sorted by/i }))
    fireEvent.click(screen.getByRole('button', { name: /^Name/ }))

    expect(view('project-a').sortKey).toBe('name')
    expect(view('project-b').sortKey).toBe('date')
    expect(screen.getByRole('button', { name: /sorted by/i })).toHaveTextContent('Name')
  })

  it('Appearance changes only the project it is in', () => {
    render(<AppearancePopover projectId="project-a" />)
    fireEvent.click(screen.getByRole('button', { name: /appearance/i }))
    fireEvent.click(screen.getByRole('button', { name: 'List' }))

    expect(view('project-a').layout).toBe('list')
    expect(view('project-b').layout).toBe('grid')
  })
})
