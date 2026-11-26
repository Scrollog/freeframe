import type { SortDirection, SortKey, ViewSettings } from '@/stores/view-store'

// Pure helpers for the per-project folder view settings. They live outside the
// store module so a test that mocks the store still gets the real rules.

/** The direction a sort starts in when picked: newest first for dates,
 *  A-Z for everything else. */
export function naturalSortDirection(key: SortKey): SortDirection {
  return key === 'date' ? 'desc' : 'asc'
}

/**
 * The settings a project remembers for itself: everything in the Appearance
 * popover plus the sort. The right panel stays one setting for the whole app.
 */
export const PROJECT_VIEW_KEYS = [
  'layout', 'cardSize', 'aspectRatio', 'thumbnailScale', 'showCardInfo',
  'titleLines', 'flattenFolders', 'showFileSize', 'showUploader',
  'sortKey', 'sortDirection',
] as const satisfies readonly (keyof ViewSettings)[]

export type ProjectViewSettings = Pick<ViewSettings, (typeof PROJECT_VIEW_KEYS)[number]>

/** How many projects keep their own settings; the least recently changed go first. */
export const MAX_PROJECT_VIEWS = 200

/** The values each setting may take, to drop anything a stored copy got wrong. */
const ALLOWED: { [K in keyof ProjectViewSettings]: readonly ProjectViewSettings[K][] } = {
  layout: ['grid', 'list'],
  cardSize: ['S', 'M', 'L'],
  aspectRatio: ['landscape', 'square', 'portrait'],
  thumbnailScale: ['fit', 'fill'],
  showCardInfo: [true, false],
  titleLines: ['1', '2', '3'],
  flattenFolders: [true, false],
  showFileSize: [true, false],
  showUploader: [true, false],
  sortKey: ['custom', 'date', 'name', 'status', 'type'],
  sortDirection: ['asc', 'desc'],
}

/** The global (non-project) values of the project settings. */
export function pickProjectView(s: ProjectViewSettings): ProjectViewSettings {
  const out = {} as Record<string, unknown>
  for (const k of PROJECT_VIEW_KEYS) out[k] = s[k]
  return out as ProjectViewSettings
}

/**
 * The settings a view shows. Inside a project (a non-empty id) that is the
 * project's own copy; a project that has none yet, and every view outside a
 * project (My assets), uses the global settings. A stored value that isn't
 * one the setting allows falls back to the global one.
 */
export function resolveProjectView(
  state: ProjectViewSettings & { projectViews?: Record<string, Partial<ProjectViewSettings>> },
  projectId: string | null | undefined,
): ProjectViewSettings {
  const base = pickProjectView(state)
  const saved = projectId ? state.projectViews?.[projectId] : undefined
  if (!saved || typeof saved !== 'object') return base
  const out = { ...base } as Record<string, unknown>
  for (const k of PROJECT_VIEW_KEYS) {
    const v = (saved as Record<string, unknown>)[k]
    if ((ALLOWED[k] as readonly unknown[]).includes(v)) out[k] = v
  }
  return out as ProjectViewSettings
}

