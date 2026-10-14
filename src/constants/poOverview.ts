/* PO Overview API (POST_FG routes/po-overview.routes.ts): endpoints, paging, query names. */

export const PO_OVERVIEW_ENDPOINT = {
  SHIPMENTS: '/po-overview/shipments',
  SHIPMENT: (uid: string) => `/po-overview/shipments/${encodeURIComponent(uid)}`,
  LINES: '/po-overview/lines',
  FILTER_OPTIONS: '/po-overview/filter-options',
  COLUMNS: '/po-overview/columns',
} as const

/** Rows per request (the backend's default; PEPIMS loads 200 at a time). */
export const PO_OVERVIEW_PAGE_SIZE = 200

/** Wait this long after typing before searching. */
export const SEARCH_DELAY_MS = 350

/** notAssigned=<value>: dates still empty. */
export const NOT_ASSIGNED_DATES = ['workingDate', 'dispatchDate', 'appointmentDate', 'rtsDate'] as const

/** The first tab of the Shipment Status: every column, view only. */
export const OVERVIEW_TAB = { KEY: 'overview', LABEL: 'Overview' } as const

/** Group header labels of the grid. */
export const COLUMN_GROUP_LABEL = { KEY: 'PO', SHIPMENT: 'Shipment' } as const
