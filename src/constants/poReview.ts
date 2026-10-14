/* PO review API (POST_FG GET /po-review): statuses, limits and how the screens show its values. */

export const PO_REVIEW_ENDPOINT = '/po-review'

/** po_uploads.status values the screens ask for. */
export const PO_STATUS = {
  NEEDS_REVIEW: 'needs_review',
  COMPLETED: 'completed',
} as const

/** The backend's largest page; the Processed tab loads a whole date range at once. */
export const PO_REVIEW_MAX_PAGE_SIZE = 500

/** Days shown when the Processed tab opens (today and the two before). */
export const PROCESSED_DEFAULT_DAYS = 3

/** Dates and times are shown in Indian time. */
export const DISPLAY_TIME_ZONE = 'Asia/Kolkata'

/** po_uploads.source -> the label the design uses. */
export const SOURCE_LABELS: Record<string, 'API' | 'Webhook' | 'Email' | 'Manual'> = {
  api: 'API',
  email: 'Email',
  manual: 'Manual',
}

/** po_issues.status */
export const ISSUE_STATUS = { OPEN: 'open' } as const

/** po_issues.issue_type -> what the reviewer reads. */
export const ISSUE_LABELS: Record<string, string> = {
  OCR_ISSUE: 'OCR problem',
  DUPLICATE_PO: 'Duplicate PO',
  LOCATION_NOT_MAPPED: 'Location not mapped',
  SKU_NOT_MAPPED: 'SKU not mapped',
  PRICE_MISMATCH: 'Price mismatch',
  MRP_MISMATCH: 'MRP mismatch',
  QTY_MISMATCH: 'Qty mismatch',
  TOTAL_MISMATCH: 'Total mismatch',
  PO_EXPIRED: 'PO expired',
  OTHER: 'Other',
}

/** po_issues.field_name of header issues -> the review panel field they belong to. */
export const ISSUE_FIELD = {
  DELIVERY_LOCATION: 'delivery_location',
  PO_NUMBER: 'po_number',
  EXPIRY_DATE: 'expiry_date',
  PO_TYPE: 'po_type',
  PO_VALUE: 'po_value',
} as const

/** Error codes the review panel acts on (POST_FG constants/errors.ts). */
export const REVIEW_ERROR = {
  /** Corrections sent, but issues are still open: details.openIssues lists them. */
  INCOMPLETE: 'REVIEW_INCOMPLETE',
  /** Someone else already resubmitted or rejected this PO. */
  NOT_IN_REVIEW: 'UPLOAD_NOT_IN_REVIEW',
} as const

/** File types the browser can show in the document viewer; the rest are offered as a download. */
export const PREVIEW_TYPES = { PDF: ['pdf'], HTML: ['html', 'htm'], IMAGE: ['png', 'jpg', 'jpeg'] } as const

/**
 * The page-by-page PDF viewer: zoom steps are multiples of "fit to width" (1 = the page fills the box's width);
 * padding is the gap in px around the page.
 */
export const PDF_VIEWER = { ZOOM_STEPS: [0.5, 0.75, 1, 1.25, 1.5, 2, 2.5, 3, 4], FIT: 1, PADDING: 16 } as const

/** Review panel texts. */
export const REVIEW_TEXT = {
  INTRO: 'Check the parsed fields against the original, correct anything wrong, then create the PO.',
  VIEW_ONLY: 'View only: ask an admin for editor access to create or reject POs.',
  CREATE: 'Create PO & mark processed',
  REJECT: 'Reject PO',
  REJECT_PROMPT: 'Why is this PO rejected? (required, kept with the PO)',
  REMARK: 'Remark (optional, kept with the PO)',
  DUPLICATE_ONLY_REJECT: 'A duplicate PO can only be rejected.',
  NO_FILE: 'The PO file is not in S3.',
  NO_PREVIEW: 'This file type cannot be shown here. Download it to view it.',
  PDF_LOADING: 'Loading the PO file…',
  PDF_FAILED: 'Could not show the PO file here. Open it in a new tab or download it.',
  CREATED: (po: string, code: string) => `PO ${po} created: sale order ${code}, Uniware CSV saved in S3.`,
  REJECTED: (po: string) => `PO ${po} rejected.`,
} as const

/** Issue types that can only be rejected (never corrected or accepted). */
export const REJECT_ONLY_ISSUES = ['DUPLICATE_PO']
