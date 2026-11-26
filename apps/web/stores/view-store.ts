import { create } from 'zustand'
import { createJSONStorage, persist, type StateStorage } from 'zustand/middleware'
import {
  MAX_PROJECT_VIEWS,
  naturalSortDirection,
  resolveProjectView,
  type ProjectViewSettings,
} from '@/lib/project-view'

export type { ProjectViewSettings }

export type ViewLayout = 'grid' | 'list'
export type CardSize = 'S' | 'M' | 'L'
export type AspectRatio = 'landscape' | 'square' | 'portrait'
export type ThumbnailScale = 'fit' | 'fill'
export type TitleLines = '1' | '2' | '3'
export type SortKey = 'custom' | 'date' | 'name' | 'status' | 'type'
export type SortDirection = 'asc' | 'desc'

// Kept here for existing importers; the rule lives with the per-project helpers.
export { naturalSortDirection }

export interface ViewSettings {
  layout: ViewLayout
  cardSize: CardSize
  aspectRatio: AspectRatio
  thumbnailScale: ThumbnailScale
  showCardInfo: boolean
  titleLines: TitleLines
  flattenFolders: boolean
  showFileSize: boolean
  showUploader: boolean
  sortKey: SortKey
  sortDirection: SortDirection
  rightPanelOpen: boolean
}

interface ViewStore extends ViewSettings {
  /** Each project's own Appearance and sort, by project id. */
  projectViews: Record<string, ProjectViewSettings>
  /**
   * Changes settings for one project. Its first change copies the current
   * global settings, so from then on the project no longer follows them.
   */
  setProjectView: (projectId: string, patch: Partial<ProjectViewSettings>) => void

  setLayout: (layout: ViewLayout) => void
  setCardSize: (size: CardSize) => void
  setAspectRatio: (ratio: AspectRatio) => void
  setThumbnailScale: (scale: ThumbnailScale) => void
  setShowCardInfo: (show: boolean) => void
  setTitleLines: (lines: TitleLines) => void
  setFlattenFolders: (flatten: boolean) => void
  setShowFileSize: (show: boolean) => void
  setShowUploader: (show: boolean) => void
  setSortKey: (key: SortKey) => void
  setSortDirection: (dir: SortDirection) => void
  toggleSortDirection: () => void
  toggleRightPanel: () => void
}

export const VIEW_STORAGE_KEY = 'freeframe-view-settings'

/**
 * localStorage that never throws: blocked storage (private mode, a sandboxed
 * frame) or a full quota just means the settings aren't remembered, instead of
 * breaking the click that changed them.
 */
const safeLocalStorage: StateStorage = {
  getItem: (name) => {
    try {
      return window.localStorage.getItem(name)
    } catch {
      return null
    }
  },
  setItem: (name, value) => {
    try {
      window.localStorage.setItem(name, value)
    } catch {
      // Not remembered; the setting still applies for this visit.
    }
  },
  removeItem: (name) => {
    try {
      window.localStorage.removeItem(name)
    } catch {
      // Nothing to do.
    }
  },
}

export const useViewStore = create<ViewStore>()(
  persist(
    (set) => ({
      layout: 'grid',
      cardSize: 'M',
      aspectRatio: 'landscape',
      thumbnailScale: 'fit',
      showCardInfo: true,
      titleLines: '1',
      flattenFolders: false,
      showFileSize: true,
      showUploader: true,
      sortKey: 'date',
      sortDirection: 'desc',
      rightPanelOpen: true,
      projectViews: {},

      setProjectView: (projectId, patch) =>
        set((s) => {
          const next = { ...resolveProjectView(s, projectId), ...patch }
          // Re-insert so the key order is "least recently changed first".
          const views = { ...s.projectViews }
          delete views[projectId]
          views[projectId] = next
          const ids = Object.keys(views)
          for (const id of ids.slice(0, Math.max(0, ids.length - MAX_PROJECT_VIEWS))) delete views[id]
          return { projectViews: views }
        }),
      setLayout: (layout) => set({ layout }),
      setCardSize: (size) => set({ cardSize: size }),
      setAspectRatio: (ratio) => set({ aspectRatio: ratio }),
      setThumbnailScale: (scale) => set({ thumbnailScale: scale }),
      setShowCardInfo: (show) => set({ showCardInfo: show }),
      setTitleLines: (lines) => set({ titleLines: lines }),
      setFlattenFolders: (flatten) => set({ flattenFolders: flatten }),
      setShowFileSize: (show) => set({ showFileSize: show }),
      setShowUploader: (show) => set({ showUploader: show }),
      setSortKey: (key) => set({ sortKey: key, sortDirection: naturalSortDirection(key) }),
      setSortDirection: (dir) => set({ sortDirection: dir }),
      toggleSortDirection: () =>
        set((s) => ({ sortDirection: s.sortDirection === 'asc' ? 'desc' : 'asc' })),
      toggleRightPanel: () =>
        set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
    }),
    {
      name: VIEW_STORAGE_KEY,
      storage: createJSONStorage(() => safeLocalStorage),
      // A stored copy from before per-project settings has no projectViews;
      // a damaged one may have something that isn't a map. Either way, start
      // with no project overrides rather than trip over it later.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<ViewStore>
        const views = p.projectViews
        return {
          ...current,
          ...p,
          projectViews:
            views && typeof views === 'object' && !Array.isArray(views) ? views : {},
        }
      },
    },
  ),
)
