/* App-shell settings (2026-10-14): data cache, sidebar, full view. */

/**
 * TanStack Query (the frontend data cache): data loaded once is shown at once when a page is opened again; data older
 * than STALE_MS is refetched quietly in the background (the screen keeps the old data meanwhile). Unused data is
 * dropped after GC_MS. Not the backend cache (that comes later).
 */
export const QUERY_CACHE = {
  STALE_MS: 2 * 60 * 1000,
  GC_MS: 15 * 60 * 1000,
  RETRY: 1,
} as const

/** Browser storage key: the sidebar stays collapsed / expanded across reloads (per browser). */
export const SIDEBAR_COLLAPSED_KEY = 'postfg.sidebar.collapsed'

/**
 * Height of a big table's own scroll area, so its header row and its sideways scrollbar are always on screen
 * (window height minus the page's top bar, title and toolbar).
 */
export const TABLE_HEIGHT = {
  PAGE: 'calc(100vh - 330px)',
  FULL_SCREEN: 'calc(100vh - 210px)',
} as const
