import { api, apiWithMeta } from './client'
import { PO_OVERVIEW_ENDPOINT } from '../constants/poOverview'

/*
 * GET /po-overview/...: our POs at shipment level and line level (API_REFERENCE.md 3.6). A shipment is every
 * master_purchase_orders column as stored (dates YYYY-MM-DD, empty = null) plus the line sums and the computed columns.
 */

export type ShipmentItem = {
  uid: string
  [column: string]: unknown
  lines: number
  updatedQty: number
  updatedGmv: number
  updatedPoValue: number
  currentAppointmentDate: string | null
  statusFinal: string | null
  tatDays: number | null
  criticalDispatchDate: string | null
  ratePerKg: number | null
  deliveryType: string
  channelType: string | null
}

export type LineItem = {
  id: string
  shipmentUid: string
  srNo: string | null
  skuName: string | null
  skuCode: string | null
  channelSkuCode: string | null
  brandName: string | null
  qty: number | null
  gmv: number | null
  poValue: number | null
  updatedQty: number | null
  updatedGmv: number | null
  updatedPoValue: number | null
  productWeightG: number | null
  entryDate: string | null
  poDate: string | null
  poNumber: string | null
  channel: string | null
  location: string | null
  facility: string | null
  workingDatePlanner: string | null
  dispatchDate: string | null
  currentAppointmentDate: string | null
  statusPlanning: string | null
  statusWarehouse: string | null
  statusLogistics: string | null
  statusFinal: string | null
}

export type ListMeta = { page: number; pageSize: number; total: number }

export type FilterOptions = {
  brand: string[]
  channel: string[]
  facility: string[]
  location: string[]
  statusPlanning: string[]
  statusWarehouse: string[]
  statusLogistics: string[]
  statusFinal: string[]
  transporter: string[]
  notAssigned: string
}

/** Query parameters: a list repeats the parameter (?channel=a&channel=b); empty values are left out. */
export type ListParams = Record<string, string | string[] | number | undefined>

const qs = (params: ListParams) => {
  const s = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (Array.isArray(v)) v.filter(Boolean).forEach((x) => s.append(k, x))
    else if (v !== undefined && v !== '') s.set(k, String(v))
  }
  return s.toString()
}

export const listShipments = (params: ListParams, signal?: AbortSignal) =>
  apiWithMeta<ShipmentItem[], ListMeta>(`${PO_OVERVIEW_ENDPOINT.SHIPMENTS}?${qs(params)}`, { signal })

export const listLines = (params: ListParams, signal?: AbortSignal) =>
  apiWithMeta<LineItem[], ListMeta>(`${PO_OVERVIEW_ENDPOINT.LINES}?${qs(params)}`, { signal })

export const getShipment = (uid: string, signal?: AbortSignal) =>
  api<{ shipment: ShipmentItem; lines: LineItem[] }>(PO_OVERVIEW_ENDPOINT.SHIPMENT(uid), { signal })

export const getFilterOptions = (signal?: AbortSignal) => api<FilterOptions>(PO_OVERVIEW_ENDPOINT.FILTER_OPTIONS, { signal })

/* GET /po-overview/columns: the column groups per team, in workflow order, and the person's access to each. */

export type ColumnDef = { field: string; label: string; kind: 'text' | 'mono' | 'date' | 'num' | 'money' | 'link' | 'status' }
export type TeamColumns = { key: string; label: string; step: number; access: 'view' | 'edit'; columns: ColumnDef[] }
export type PoOverviewColumns = { keyColumns: ColumnDef[]; systemColumns: ColumnDef[]; teams: TeamColumns[] }

export const getColumns = (signal?: AbortSignal) => api<PoOverviewColumns>(PO_OVERVIEW_ENDPOINT.COLUMNS, { signal })
