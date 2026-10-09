import { useState } from 'react'
import { Boxes, Database, PencilLine, Upload } from 'lucide-react'
import { Drawer, Button, PageTitle } from '../../components/ui'
import { DataGrid, Field, FilterPanel, PrimaryBtn, SectionToolbar, exportRows, inputCls, useSection, Cell, type FilterDef } from '../../components/kit'
import {
  BRANDS, CITIES, FACILITIES, FINAL_STATUSES, OPS_CHANNELS, PO_LINES, PO_LINE_COLS, SHIPMENTS, SHIPMENT_COLS, ST_LOGISTICS, ST_PLANNING, ST_WAREHOUSE, TRANSPORTERS,
  type POLineRow, type Shipment,
} from '../../lib/ops'

const common = (): FilterDef[] => [
  { key: 'brand', label: 'Brand', type: 'multi', options: BRANDS, placeholder: 'Select brands' },
  { key: 'channel', label: 'Channel', type: 'multi', options: OPS_CHANNELS, placeholder: 'Select channels' },
  { key: 'facility', label: 'Facility', type: 'multi', options: FACILITIES, placeholder: 'Select facilities' },
  { key: 'location', label: 'Location', type: 'multi', options: CITIES, placeholder: 'Select locations' },
  { key: 'statusPlanning', label: 'Status Planning', type: 'multi', options: ST_PLANNING, placeholder: 'Select status' },
  { key: 'statusWarehouse', label: 'Status Warehouse', type: 'multi', options: ST_WAREHOUSE, placeholder: 'Select status' },
  { key: 'statusLogistics', label: 'Status Logistics', type: 'multi', options: ST_LOGISTICS, placeholder: 'Select status' },
  { key: 'status', label: 'Final Status', type: 'multi', options: FINAL_STATUSES, placeholder: 'Select status' },
]

const SHIP_FILTERS: FilterDef[] = [
  { key: 'notAssigned', label: 'Not Assigned Dates', type: 'multi', options: ['workingDate', 'dispatchDate', 'currentApptDate', 'rtsDate'], placeholder: 'Select not-assigned dates' },
  { key: 'poDateFrom', label: 'PO Date From', type: 'date' }, { key: 'poDateTo', label: 'PO Date To', type: 'date' },
  { key: 'workingDateFrom', label: 'Working Date From', type: 'date' }, { key: 'workingDateTo', label: 'Working Date To', type: 'date' },
  { key: 'dispatchDateFrom', label: 'Dispatch Date From', type: 'date' }, { key: 'dispatchDateTo', label: 'Dispatch Date To', type: 'date' },
  { key: 'currentApptDateFrom', label: 'Current Appt From', type: 'date' }, { key: 'currentApptDateTo', label: 'Current Appt To', type: 'date' },
  ...common(),
  { key: 't1', label: 'Transporter Name', type: 'multi', options: TRANSPORTERS, placeholder: 'Select transporter' },
  { key: 'd1', label: 'Search Docket No', type: 'text', placeholder: 'e.g. DL48213…' },
]

const LINE_FILTERS: FilterDef[] = [
  { key: 'poDateFrom', label: 'PO Date From', type: 'date' }, { key: 'poDateTo', label: 'PO Date To', type: 'date' },
  { key: 'workingDateFrom', label: 'Working Date From', type: 'date' }, { key: 'workingDateTo', label: 'Working Date To', type: 'date' },
  ...common().slice(0, 4),
  { key: 'skuCode', label: 'SKU Code', type: 'text', placeholder: 'Enter SKU code' },
  ...common().slice(4),
]

export default function POOverview() {
  const [tab, setTab] = useState<'shipment' | 'lines'>('shipment')
  return (
    <div className="space-y-5">
      <PageTitle title="PO Overview" sub="Every PO at shipment level and SKU-line level · bulk edit via CSV, export anytime" />
      <div className="grid grid-cols-2 gap-1 rounded-[var(--radius-card)] bg-alt p-1">
        {([['shipment', 'Shipment Status', Database], ['lines', 'PO Format Data', Boxes]] as const).map(([k, l, Icon]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`flex items-center justify-center gap-2 rounded-[var(--radius)] py-2 text-[13px] font-semibold transition-all ${tab === k ? 'bg-surface text-ink-900 shadow-sm ring-1 ring-line' : 'text-ink-600 hover:text-ink-900'}`}
          >
            <Icon className="size-4" /> {l}
            <span className="tnum text-[11px] font-medium text-ink-400">{k === 'shipment' ? SHIPMENTS.length : PO_LINES.length}</span>
          </button>
        ))}
      </div>
      {tab === 'shipment' ? <ShipmentTab /> : <LinesTab />}
    </div>
  )
}

function ShipmentTab() {
  const s = useSection<Shipment>(SHIPMENTS, ['poNumber', 'uid'])
  const [sel, setSel] = useState<Shipment | null>(null)
  return (
    <div className="space-y-3">
      <SectionToolbar
        q={s.q} setQ={s.setQ} placeholder="Search by PO Number or UID…" filtersOpen={s.open} onToggleFilters={() => s.setOpen(!s.open)} activeFilters={s.active}
        entity="Shipment Status" onExport={(e) => exportRows('shipment_status', e, SHIPMENT_COLS, s.filtered)}
        primary={<PrimaryBtn icon={<PencilLine className="size-4" />}>Bulk Edit</PrimaryBtn>}
      />
      {s.open && <FilterPanel defs={SHIP_FILTERS} value={s.filters} onApply={s.setFilters} onClose={() => s.setOpen(false)} />}
      <DataGrid
        cols={SHIPMENT_COLS} rows={s.filtered} rowKey={(r) => r.uid} sticky={1} onRowClick={setSel}
        trailing={[{ label: 'Status', render: (r) => <Cell kind="status" v={r.status} /> }]}
        rowMenu={(r) => [{ label: 'View details', onClick: () => setSel(r) }, { label: 'Edit dates', onClick: () => setSel(r) }, { label: 'Duplicate shipment', onClick: () => {} }]}
      />
      {sel && (
        <Drawer open onClose={() => setSel(null)} title={<span className="font-mono">{sel.poNumber}</span>} sub={`UID ${sel.uid} · ${sel.channel} · ${sel.location}`}
          footer={<><Button onClick={() => setSel(null)}>Close</Button><Button variant="primary" onClick={() => setSel(null)}>Save changes</Button></>}>
          <div className="divide-y divide-line">
            {SHIPMENT_COLS.map(([l, k, kind]) => <Field key={l} label={l}><Cell kind={kind} v={sel[k]} /></Field>)}
          </div>
        </Drawer>
      )}
    </div>
  )
}

function LinesTab() {
  const s = useSection<POLineRow>(PO_LINES, ['poNumber', 'shipmentUid', 'skuCode'])
  const [sel, setSel] = useState<POLineRow | null>(null)
  const [qty, setQty] = useState('')
  return (
    <div className="space-y-3">
      <SectionToolbar
        q={s.q} setQ={s.setQ} placeholder="Search by PO Number or Shipment UID…" filtersOpen={s.open} onToggleFilters={() => s.setOpen(!s.open)} activeFilters={s.active}
        entity="PO Format Data" onExport={(e) => exportRows('po_format_data', e, PO_LINE_COLS, s.filtered)}
        primary={<PrimaryBtn icon={<Upload className="size-4" />}>Bulk SKU Update</PrimaryBtn>}
      />
      {s.open && <FilterPanel defs={LINE_FILTERS} value={s.filters} onApply={s.setFilters} onClose={() => s.setOpen(false)} />}
      <DataGrid
        cols={PO_LINE_COLS} rows={s.filtered} rowKey={(r) => `${r.shipmentUid}-${r.srNo}`} sticky={1}
        onRowClick={(r) => { setSel(r); setQty(String(r.updatedQuantity)) }}
        trailing={[{ label: 'Status', render: (r) => <Cell kind="status" v={r.status} /> }]}
        rowMenu={(r) => [{ label: 'Update quantity', onClick: () => { setSel(r); setQty(String(r.updatedQuantity)) } }, { label: 'View shipment', onClick: () => {} }]}
      />
      {sel && (
        <Drawer open onClose={() => setSel(null)} title={sel.skuName} sub={<><span className="font-mono">{sel.skuCode}</span> · PO <span className="font-mono">{sel.poNumber}</span> · line {sel.srNo}</>}
          footer={<><Button onClick={() => setSel(null)}>Cancel</Button><Button variant="primary" onClick={() => setSel(null)}>Submit for approval</Button></>}>
          <div className="mb-4 rounded-[var(--radius)] bg-canvas p-3">
            <div className="mb-1 text-[12px] font-medium text-ink-600">Updated quantity</div>
            <input type="number" value={qty} onChange={(e) => setQty(e.target.value)} className={inputCls} />
            <p className="mt-1.5 text-[12px] text-ink-400">Ordered {sel.quantity.toLocaleString('en-IN')} · changes route to Approvals</p>
          </div>
          <div className="divide-y divide-line">
            {PO_LINE_COLS.map(([l, k, kind]) => <Field key={l} label={l}><Cell kind={kind} v={sel[k]} /></Field>)}
          </div>
        </Drawer>
      )}
    </div>
  )
}
