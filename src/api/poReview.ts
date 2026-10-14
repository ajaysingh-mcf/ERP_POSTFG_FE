import { api, apiUrl, ApiError } from './client'
import { ERROR_CODE } from '../constants/auth'
import { PO_REVIEW_ENDPOINT } from '../constants/poReview'

/* GET /po-review: one row per PO upload (API contract "PO review"). */

export type PoReviewItem = {
  uploadId: string
  poNumber: string | null
  channel: string | null
  status: string
  ocrStatus: string
  source: string
  fileName: string
  poDate: string | null
  receivedAt: string | null
  completedAt: string | null
  brand: string | null
  saleOrderCode: string | null
  lines: number | null
  units: number | null
  poValue: number | null
  openIssues: number
  issueTypes: string[]
}

export type PoReviewListParams = {
  status: string
  channel?: string
  q?: string
  from?: string
  to?: string
  page?: number
  pageSize?: number
}

export function listPoReview(params: PoReviewListParams, signal?: AbortSignal) {
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v))
  return api<PoReviewItem[]>(`${PO_REVIEW_ENDPOINT}?${qs}`, { signal })
}

/* GET /po-review/:uploadId: one PO for the review panel. A number field is "" when the PO doesn't have it. */

export type Num = number | ''

export type PoReviewLocation = {
  detailsChannelId: string
  locationCode: string | null
  customerCode: string | null
  facilityCode: string | null
  address: string | null
  pincode: string | null
}

export type PoReviewLine = {
  lineNo: Num
  channelSkuCode: string
  ean: string
  description: string
  qty: Num
  freeQty: Num
  poMrp: Num
  poUnitPrice: Num
  poLineValue: Num
  pepCode: string
  skuName: string
  ourMrp: Num
  ourRate: Num
}

export type PoReviewIssue = {
  issueId: string
  type: string
  field: string | null
  lineNo: number | null
  details: string | null
  originalValues: Record<string, unknown> | null
  status: string
  canAccept: boolean
}

export type PoReviewDetail = {
  upload: {
    uploadId: string
    status: string
    channel: string | null
    source: string
    fileName: string
    emailFrom: string | null
    emailSubject: string | null
    receivedAt: string | null
  }
  po: {
    poNumber: string
    poDate: string
    expiryDate: string
    poType: string
    revised: boolean
    deliveryFacility: string
    shippingAddress: string
    pincode: string
    deliveryGstin: string
    totalQty: Num
    poValue: Num
    netAmount: Num
  }
  location: PoReviewLocation | null
  locationCandidates: PoReviewLocation[]
  lines: PoReviewLine[]
  totals: { poValue: Num; ourValue: Num; difference: Num }
  issues: PoReviewIssue[]
  warnings: { code: string; message: string }[]
  /** The channel's SKUs a line can be mapped to. */
  skuOptions: PoReviewSkuOption[]
  /** Short-lived download links (15 min); null when the file is not in S3. */
  files: {
    /** Opens in the browser tab. */
    poFile: string | null
    /** The same file, saved by the browser instead of opened. */
    poFileDownload: string | null
    poFileType: string | null
    processedJson: string | null
    uniwareCsv: string | null
  }
}

export type PoReviewSkuOption = {
  pepCode: string
  skuName: string | null
  channelSkuCode: string | null
  mrp: number | null
  rate: number | null
}

const one = (uploadId: string) => `${PO_REVIEW_ENDPOINT}/${encodeURIComponent(uploadId)}`

export function getPoReview(uploadId: string, signal?: AbortSignal) {
  return api<PoReviewDetail>(one(uploadId), { signal })
}

/* GET /po-review/:uploadId/file: the PO file's bytes, passed on from S3 by the backend (for the PDF viewer). */
export async function getPoFile(uploadId: string, signal?: AbortSignal): Promise<ArrayBuffer> {
  let res: Response
  try {
    res = await fetch(apiUrl(`${one(uploadId)}/file`), { credentials: 'include', signal })
  } catch {
    throw new ApiError(0, ERROR_CODE.NETWORK, 'Cannot reach the server')
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => null))?.error
    throw new ApiError(res.status, err?.code ?? `HTTP_${res.status}`, err?.message ?? res.statusText, err?.details)
  }
  return res.arrayBuffer()
}

/* POST /po-review/:uploadId/resubmit: corrections + accepts -> validate again -> saved (sale order + Uniware CSV). */

export type LineCorrection = { lineNo: string; pepCode?: string; qty?: number; mrp?: number; rate?: number }

export type ResubmitBody = {
  location?: { detailsChannelId: string }
  lines?: LineCorrection[]
  accept?: { issueId: string; remark?: string }[]
  remark?: string
}

export type ResubmitResult = { status: string; poUid: string; saleOrderCode: string; uniwareCsv: string; resolvedIssues: string[] }

/** details of a REVIEW_INCOMPLETE error: what is still failing after the corrections. */
export type StillOpen = { openIssues: { type: string; field: string; lineNo: number | null; message: string }[] }

export function resubmitPo(uploadId: string, body: ResubmitBody) {
  return api<ResubmitResult>(`${one(uploadId)}/resubmit`, { method: 'POST', body: JSON.stringify(body) })
}

/* POST /po-review/:uploadId/reject: the PO leaves the review list; nothing is saved. */
export function rejectPo(uploadId: string, remark: string) {
  return api<{ status: string; rejectedIssues: string[] }>(`${one(uploadId)}/reject`, { method: 'POST', body: JSON.stringify({ remark }) })
}
