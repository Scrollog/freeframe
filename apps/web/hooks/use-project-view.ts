'use client'

import { useViewStore, type SortKey } from '@/stores/view-store'
import {
  naturalSortDirection,
  resolveProjectView,
  type ProjectViewSettings,
} from '@/lib/project-view'

type Setter<K extends keyof ProjectViewSettings> = (value: ProjectViewSettings[K]) => void

export interface ProjectView extends ProjectViewSettings {
  setLayout: Setter<'layout'>
  setCardSize: Setter<'cardSize'>
  setAspectRatio: Setter<'aspectRatio'>
  setThumbnailScale: Setter<'thumbnailScale'>
  setShowCardInfo: Setter<'showCardInfo'>
  setTitleLines: Setter<'titleLines'>
  setFlattenFolders: Setter<'flattenFolders'>
  setShowFileSize: Setter<'showFileSize'>
  setShowUploader: Setter<'showUploader'>
  setSortKey: (key: SortKey) => void
  toggleSortDirection: () => void
}

/**
 * The folder view's Appearance and sort for one project.
 *
 * Inside a project (a non-empty `projectId`) the settings are that project's
 * own: changing them there changes no other project, and the project opens
 * with them next time. A project with nothing saved yet shows the global
 * settings until its first change. Without a project id (My assets) the
 * global settings are read and written, as before.
 */
export function useProjectView(projectId?: string | null): ProjectView {
  const store = useViewStore()
  const scoped = projectId || null
  const view = resolveProjectView(store, scoped)

  const update = (patch: Partial<ProjectViewSettings>) => {
    if (scoped) useViewStore.getState().setProjectView(scoped, patch)
    else useViewStore.setState(patch)
  }

  return {
    ...view,
    setLayout: (layout) => update({ layout }),
    setCardSize: (cardSize) => update({ cardSize }),
    setAspectRatio: (aspectRatio) => update({ aspectRatio }),
    setThumbnailScale: (thumbnailScale) => update({ thumbnailScale }),
    setShowCardInfo: (showCardInfo) => update({ showCardInfo }),
    setTitleLines: (titleLines) => update({ titleLines }),
    setFlattenFolders: (flattenFolders) => update({ flattenFolders }),
    setShowFileSize: (showFileSize) => update({ showFileSize }),
    setShowUploader: (showUploader) => update({ showUploader }),
    setSortKey: (sortKey) => update({ sortKey, sortDirection: naturalSortDirection(sortKey) }),
    toggleSortDirection: () =>
      update({ sortDirection: view.sortDirection === 'asc' ? 'desc' : 'asc' }),
  }
}
