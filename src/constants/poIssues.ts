/*
 * Users & Roles -> PO issues (user, 2026-10-22): per channel, the kinds of problems its POs had and, inside each kind,
 * every item (SKU, location, value, reason), counted once per PO. Backend: GET /admin/po-issues (admin / developer).
 */
import { ISSUE_LABELS } from './poReview'

export const PO_ISSUES_ENDPOINT = '/admin/po-issues'
export const PO_ISSUES_DAYS = [7, 30, 90, 365] as const
export const PO_ISSUES_DEFAULT_DAYS = 30

/** Kinds = the review issue types + the two outcomes counted with them. */
export const ISSUE_KIND_LABEL: Record<string, string> = {
  ...ISSUE_LABELS,
  REJECTED: 'Rejected (reasons)',
  SENT_BACK: 'Sent back at Verify (reasons)',
}

/** What the item of each kind is (column title inside a kind). */
export const ISSUE_ITEM_LABEL: Record<string, string> = {
  SKU_NOT_MAPPED: 'Channel SKU', PRICE_MISMATCH: 'Channel SKU', MRP_MISMATCH: 'Channel SKU', QTY_MISMATCH: 'Channel SKU',
  LOCATION_NOT_MAPPED: 'Location on the PO', TOTAL_MISMATCH: 'PO value', PO_EXPIRED: 'Expiry date', DUPLICATE_PO: 'PO number',
  REJECTED: 'Reason', SENT_BACK: 'Reason',
}

/** Where the POs ended (po_uploads.status). */
export const PO_STATUS_LABEL: Record<string, string> = {
  completed: 'Processed', needs_review: 'In review', pending_approval: 'Waiting approval', rejected: 'Rejected', failed: 'Failed',
  queued: 'Queued', extracting: 'Reading', processing: 'Checking',
}
export const PO_STATUS_TONE: Record<string, 'ok' | 'warn' | 'info' | 'crit' | 'neutral'> = {
  completed: 'ok', needs_review: 'warn', pending_approval: 'info', rejected: 'crit', failed: 'crit',
}

export const PO_ISSUES_TEXT = {
  TAB: 'PO issues',
  TITLE: 'PO issues by channel',
  SUB: 'Pick a channel to see the kinds of problems its POs had; open a kind to see every SKU / location / reason, and one of those to see its POs. Counted once per PO, by when the PO came in.',
  LOADING: 'Counting…',
  EMPTY: 'No POs in this period.',
  DAYS: (d: number) => (d === 365 ? '1 year' : `${d} days`),
  POS: (n: number) => `${n} PO${n === 1 ? '' : 's'}`,
  WITH_ISSUES: (n: number, of: number) => `${n} of ${of} with issues`,
  NO_ISSUES: 'No issues',
  ITEM: 'Item',
  OUR_SKU: 'Our SKU',
  COUNT: 'POs',
  LAST: 'Last seen',
  DIFF: 'Typical difference (PO − ours)',
  POS_TITLE: (kind: string, item: string) => `${kind}: ${item}`,
  PO: 'PO number',
  STATUS: 'Status',
  CAME_IN: 'Came in',
  STATE: 'Now',
  STATE_LABEL: { open: 'Still a problem', fixed: 'Fixed', final: 'Final' } as Record<string, string>,
  STATE_HINT: "Checked live against today's master data each time this page loads (not by date).",
  OPEN_OF: (open: number, total: number) => `${open} of ${total} still a problem`,
  ALL_FIXED: 'All fixed',
  HIDE_FIXED: 'Hide fixed',
} as const
