import { useMemo, useState } from 'react'
import {
  criticality, detailedRows, ERROR_QUEUE, fillRate, finalStatusColor, POS,
} from '../lib/data'
import type { ErrorRow, IntakeSource, PO, POLine } from '../lib/data'
import {
  Badge, BulkUpload, Button, Card, Dot, downloadCsv, Drawer, KPI, PageTitle,
  PillToggle, SubTabs, Td, Th, Toolbar,
} from '../components/ui'

const critTone = { Critical: 'crit', High: 'warn', Medium: 'info', Low: 'neutral' } as const
const srcTone: Record<IntakeSource, 'primary' | 'ok' | 'warn'> = { API: 'primary', Excel: 'ok', OCR: 'warn' }
const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`

const CSV_HEADERS = [
  'Entry Date', 'PO Date', 'Facility', 'Channel', 'Location', 'PO Number', 'Brand', 'Sr No',
  'SKU Name', 'SKU Code', 'Channel SKU', 'Quantity', 'GMV', 'PO Value', 'Updated Qty', 'Updated GMV',
  'Updated PO Value', 'Product Weight', 'Working Date', 'Dispatch Date', 'Current Appointment',
  'Status Planning', 'Status Warehouse', 'Status Logistics',
]
const csvRows = (pos: PO[]) =>
  pos.flatMap((p) => p.lines.map((l) => [
    p.entryDate, p.poDate, p.facility, p.channel, p.location, p.poNo, p.brand, l.srNo, l.skuName, l.skuCode,
    l.channelSku, l.qty, l.gmv, l.poValue, l.updatedQty, l.updatedGmv, l.updatedPoValue, l.productWeight,
    p.workingDate ?? '', p.dispatchDate ?? '', p.appointment ?? '', l.statusPlanning, l.statusWarehouse, l.statusLogistics,
  ]))

type Sub = 'all' | 'intake' | 'inflight' | 'closed' | 'errors'
const inTab = (p: PO, t: Sub) =>
  t === 'intake' ? ['Intake', 'Validated'].includes(p.stage)
  : t === 'inflight' ? ['COPT Verify', 'SO in Uniware', 'WH Working', 'Packed / RTS', 'Invoiced', 'Dispatched'].includes(p.stage)
  : t === 'closed' ? ['Delivered', 'GRN'].includes(p.stage)
  : true

export default function Orders() {
  const [pill, setPill] = useState<'tracking' | 'detailed'>('tracking')
  const [sub, setSub] = useState<Sub>('all')
  const [q, setQ] = useState('')
  const [drawer, setDrawer] = useState<PO | null>(null)
  const [bulk, setBulk] = useState(false)
  const [sel, setSel] = useState<Set<string>>(new Set())

  const pos = useMemo(
    () => POS.filter((p) => inTab(p, sub)).filter((p) => p.poNo.toLowerCase().includes(q.toLowerCase()) || p.channel.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => criticality(b).score - criticality(a).score),
    [sub, q],
  )

  const critical = POS.filter((p) => criticality(p).level === 'Critical').length
  const blocked = POS.filter((p) => p.blocked).length
  const avgFill = POS.reduce((s, p) => s + fillRate(p), 0) / POS.length

  const counts = {
    all: POS.length,
    intake: POS.filter((p) => inTab(p, 'intake')).length,
    inflight: POS.filter((p) => inTab(p, 'inflight')).length,
    closed: POS.filter((p) => inTab(p, 'closed')).length,
    errors: ERROR_QUEUE.length,
  }

  const toggleSel = (po: string) => setSel((s) => { const n = new Set(s); n.has(po) ? n.delete(po) : n.add(po); return n })

  return (
    <div className="space-y-5">
      <PageTitle
        title="Order Processing"
        sub="Intake → validate → COPT → sale order → dispatch → GRN · tracked at PO level, criticality drives what to work on next"
        right={<>
          <Button icon={<span>↓</span>} onClick={() => downloadCsv('po_tracking.csv', CSV_HEADERS, csvRows(pos))}>Download CSV</Button>
          <Button variant="default" icon={<span>↑</span>} onClick={() => setBulk(true)}>Bulk Upload</Button>
        </>}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <PillToggle
          value={pill}
          onChange={setPill}
          options={[{ key: 'tracking', label: 'PO Tracking' }, { key: 'detailed', label: 'Detailed view' }]}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KPI label="Critical POs" value={String(critical)} unit="open" tone="crit" delta="work first" />
        <KPI label="Inventory-blocked" value={String(blocked)} unit="POs" tone="warn" hint="short stock" />
        <KPI label="Avg fill rate" value={(avgFill * 100).toFixed(0)} unit="%" tone="ok" hint="shipped ÷ ordered" />
        <KPI label="PO → Delivery" value="10.4" unit="days" tone="info" hint="target < 12" />
      </div>

      <SubTabs
        value={sub}
        onChange={setSub}
        tabs={[
          { key: 'all', label: 'All POs', count: counts.all },
          { key: 'intake', label: 'Intake', count: counts.intake },
          { key: 'inflight', label: 'In-flight', count: counts.inflight },
          { key: 'closed', label: 'Delivered / GRN', count: counts.closed },
          { key: 'errors', label: 'Errors', count: counts.errors, danger: true },
        ]}
      />

      {sub === 'errors' ? (
        <ErrorsGrid />
      ) : pill === 'detailed' ? (
        <DetailedGrid q={q} setQ={setQ} onBulk={() => setBulk(true)} />
      ) : (
        <Card>
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Filter by PO number or channel…"
              className="w-64 rounded-md border border-line bg-canvas px-2.5 py-1.5 text-xs outline-none focus:border-primary"
            />
            <span className="text-[11px] text-ink-400">{pos.length} POs</span>
          </div>
          <Toolbar onExport={() => downloadCsv('po_tracking.csv', CSV_HEADERS, csvRows(pos))} onBulk={() => setBulk(true)} />
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead className="border-b border-line bg-alt/60">
                <tr>
                  <Th><input type="checkbox" /></Th>
                  <Th>PO Number</Th><Th>Channel / Brand</Th><Th>Facility</Th><Th>Source</Th>
                  <Th>Criticality</Th><Th right>Units</Th><Th right>Fill</Th><Th right>Expiry</Th><Th>Appointment</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {pos.map((p) => {
                  const c = criticality(p)
                  return (
                    <tr key={p.poNo} className="cursor-pointer hover:bg-alt/50" onClick={() => setDrawer(p)}>
                      <Td><input type="checkbox" checked={sel.has(p.poNo)} onClick={(e) => e.stopPropagation()} onChange={() => toggleSel(p.poNo)} /></Td>
                      <Td mono className="text-[12px] font-medium text-primary">{p.poNo}</Td>
                      <Td>
                        <div className="text-[13px] font-medium">{p.channel} <span className="text-[10px] font-normal text-ink-400">{p.segment}</span></div>
                        <div className="text-[11px] text-ink-600">{p.brand}</div>
                      </Td>
                      <Td><span className="text-[12px] text-ink-600">{p.facility}</span></Td>
                      <Td><Badge tone={srcTone[p.source]}>{p.source}</Badge></Td>
                      <Td>
                        <Badge tone={critTone[c.level]}>{c.level}</Badge>
                        {p.blocked && <span className="ml-1 text-[11px] text-crit">blocked</span>}
                      </Td>
                      <Td right mono>{p.units.toLocaleString('en-IN')}</Td>
                      <Td right mono>{(fillRate(p) * 100).toFixed(0)}%</Td>
                      <Td right><span className={`tnum text-[12px] font-semibold ${p.daysToExpiry <= 1 ? 'text-crit' : p.daysToExpiry <= 3 ? 'text-warn' : 'text-ink-900'}`}>{p.daysToExpiry}d</span></Td>
                      <Td>{p.appointment ? <Badge tone="ok">Booked</Badge> : <Badge tone="warn">Not booked</Badge>}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Bulk action bar */}
      {sel.size > 0 && sub !== 'errors' && pill === 'tracking' && (
        <div className="sticky bottom-4 z-10 mx-auto flex w-fit items-center gap-3 rounded-full border border-line bg-ink-900 px-4 py-2 text-white shadow-lg">
          <span className="text-[12px]">{sel.size} selected</span>
          <button className="rounded-full bg-primary px-3 py-1 text-[12px] font-semibold">Bulk edit appointment & status</button>
          <button onClick={() => setSel(new Set())} className="text-[12px] text-slate-300 hover:text-white">Cancel</button>
        </div>
      )}

      {drawer && <PODrawer po={drawer} onClose={() => setDrawer(null)} />}
      <BulkUpload open={bulk} onClose={() => setBulk(false)} entity="PO Tracking" onDownloadTemplate={() => downloadCsv('po_template.csv', CSV_HEADERS, [])} />
    </div>
  )
}

// ---- PO detail drawer -------------------------------------------------
function PODrawer({ po, onClose }: { po: PO; onClose: () => void }) {
  const c = criticality(po)
  const [appt, setAppt] = useState(po.appointment ?? '')
  const [reason, setReason] = useState('')
  const [qty, setQty] = useState<Record<number, number>>(Object.fromEntries(po.lines.map((l) => [l.srNo, l.updatedQty])))
  const apptChanged = appt !== (po.appointment ?? '')
  const dirty = apptChanged || po.lines.some((l) => qty[l.srNo] !== l.updatedQty)
  const canSave = dirty && (!apptChanged || reason.trim().length > 0)

  return (
    <Drawer
      open
      onClose={onClose}
      title={<span className="font-mono">{po.poNo}</span>}
      sub={`${po.channel} · ${po.segment} · ${po.brand} · via ${po.source} · ${po.facility}`}
      footer={<>
        <Button onClick={onClose}>Close</Button>
        <Button variant={canSave ? 'primary' : 'default'} onClick={onClose}>Save changes</Button>
      </>}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={critTone[c.level]}>{c.level} · {c.score}</Badge>
        <Badge tone="neutral">{po.stage}</Badge>
        {po.blocked && <Badge tone="crit">blocked · {po.blockedSku}</Badge>}
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[12px]">
        {[
          ['Entry Date', po.entryDate], ['PO Date', po.poDate], ['Location', po.location], ['Working Date', po.workingDate ?? '—'],
          ['Dispatch Date', po.dispatchDate ?? '—'], ['Units ordered', po.units.toLocaleString('en-IN')], ['PO value', inr(po.value)], ['Days to expiry', `${po.daysToExpiry}d`],
        ].map(([k, v]) => (
          <div key={k}><dt className="text-ink-400">{k}</dt><dd className="tnum mt-0.5 font-medium text-ink-900">{v}</dd></div>
        ))}
      </dl>

      <div className="mt-5 rounded-lg border border-line bg-canvas p-3">
        <div className="mb-2 text-[12px] font-semibold text-ink-900">Appointment</div>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="mb-1 block text-[11px] text-ink-400">Current appointment date</label>
            <input type="date" value={appt} onChange={(e) => setAppt(e.target.value)} className="rounded-md border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-primary" />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-[11px] text-ink-400">Reason for change {apptChanged && <span className="text-crit">*</span>}</label>
            <input value={reason} onChange={(e) => setReason(e.target.value)} disabled={!apptChanged} placeholder={apptChanged ? 'Required — e.g. slot rejected, rebooked' : 'No change'}
              className="w-full rounded-md border border-line bg-surface px-2.5 py-1.5 text-[13px] outline-none focus:border-primary disabled:bg-alt disabled:text-ink-400" />
          </div>
        </div>
      </div>

      <div className="mt-5">
        <div className="mb-2 text-[12px] font-semibold text-ink-900">SKU lines ({po.lines.length}) · Updated Qty editable</div>
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full border-collapse">
            <thead className="border-b border-line bg-alt/60">
              <tr><Th>Sr</Th><Th>SKU</Th><Th>Channel SKU</Th><Th right>Qty</Th><Th right>Updated</Th><Th right>Wt</Th><Th>Plan</Th><Th>WH</Th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {po.lines.map((l: POLine) => {
                const changed = qty[l.srNo] !== l.updatedQty
                return (
                  <tr key={l.srNo} className="hover:bg-alt/40">
                    <Td mono>{l.srNo}</Td>
                    <Td>
                      <div className="text-[12px]">{l.skuName}</div>
                      <div className="font-mono text-[11px] text-primary">{l.skuCode}</div>
                    </Td>
                    <Td mono className="text-[12px] text-ink-600">{l.channelSku}</Td>
                    <Td right mono>{l.qty.toLocaleString('en-IN')}</Td>
                    <Td right>
                      <input
                        type="number"
                        value={qty[l.srNo]}
                        onChange={(e) => setQty((s) => ({ ...s, [l.srNo]: Number(e.target.value) }))}
                        className={`tnum w-20 rounded border px-1.5 py-1 text-right text-[12px] outline-none focus:border-primary ${changed ? 'border-warn bg-warn-soft' : 'border-line'}`}
                      />
                    </Td>
                    <Td right mono>{l.productWeight}</Td>
                    <Td><span className="text-[12px] text-ink-600">{l.statusPlanning}</span></Td>
                    <Td><span className="text-[12px] text-ink-600">{l.statusWarehouse}</span></Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </Drawer>
  )
}

// ---- Detailed flat grid ----------------------------------------------
function DetailedGrid({ q, setQ, onBulk }: { q: string; setQ: (v: string) => void; onBulk: () => void }) {
  const rows = detailedRows().filter((r) => r.poNo.toLowerCase().includes(q.toLowerCase()) || r.shipmentUid.toLowerCase().includes(q.toLowerCase()))
  const [pageSize, setPageSize] = useState(100)
  const cols = ['Shipment UID', 'Entry Date', 'Brand', 'Channel', 'Location', 'PO Date', 'PO Number', 'Sr No', 'SKU Name', 'SKU Code', 'Channel SKU', 'Quantity', 'GMV', 'PO Value', 'Updated Qty', 'Updated GMV', 'Updated PO Value', 'Facility']

  return (
    <Card>
      {/* Filter bar */}
      <div className="grid gap-2 border-b border-line px-3 py-3 sm:grid-cols-3 lg:grid-cols-6">
        {['PO Date From', 'PO Date To', 'Working Date From', 'Working Date To'].map((f) => (
          <label key={f} className="block"><span className="mb-1 block text-[10px] text-ink-400">{f}</span><input type="date" className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[12px] outline-none focus:border-primary" /></label>
        ))}
        {['Brand', 'Channel', 'Facility', 'Location', 'Status Planning', 'Status Warehouse', 'Status Logistics', 'Final Status'].map((f) => (
          <label key={f} className="block"><span className="mb-1 block text-[10px] text-ink-400">{f}</span>
            <select className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[12px] outline-none focus:border-primary"><option>All</option></select>
          </label>
        ))}
        <label className="block"><span className="mb-1 block text-[10px] text-ink-400">SKU Code</span><input className="w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[12px] outline-none focus:border-primary" /></label>
        <div className="flex items-end"><Button variant="ghost">Clear All</Button></div>
      </div>

      {/* Toolbar + pagination top */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="PO Number or Shipment UID…" className="w-64 rounded-md border border-line bg-canvas px-2.5 py-1.5 text-xs outline-none focus:border-primary" />
        <span className="text-[11px] text-ink-400">{Math.min(pageSize, rows.length)} of {rows.length} Records</span>
        <div className="ml-auto flex items-center gap-2">
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} className="rounded-md border border-line bg-surface px-2 py-1 text-[12px]">
            {[100, 200, 500].map((n) => <option key={n} value={n}>{n} / page</option>)}
          </select>
          <Button icon={<span>↓</span>} onClick={() => downloadCsv('detailed.csv', cols.concat('Final Status'), rows.map((r) => [r.shipmentUid, r.entryDate, r.brand, r.channel, r.location, r.poDate, r.poNo, r.srNo, r.skuName, r.skuCode, r.channelSku, r.qty, r.gmv, r.poValue, r.updatedQty, r.updatedGmv, r.updatedPoValue, r.facility, r.finalStatus]))}>Export CSV</Button>
          <Button icon={<span>↑</span>} onClick={onBulk}>Bulk SKU Update</Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="border-b border-line bg-alt/60">
            <tr>
              {cols.map((c, i) => <Th key={c} right={i >= 11 && i <= 16}>{c}</Th>)}
              <Th>Action</Th><Th>Status</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.slice(0, pageSize).map((r) => (
              <tr key={r.shipmentUid} className="hover:bg-alt/40">
                <Td mono className="text-[12px] font-medium text-primary">{r.shipmentUid}</Td>
                <Td mono className="text-[12px] text-ink-600">{r.entryDate}</Td>
                <Td>{r.brand}</Td><Td>{r.channel}</Td><Td>{r.location}</Td>
                <Td mono className="text-[12px] text-ink-600">{r.poDate}</Td>
                <Td mono className="text-[12px] text-primary">{r.poNo}</Td>
                <Td mono>{r.srNo}</Td>
                <Td><span className="text-[12px]">{r.skuName}</span></Td>
                <Td mono className="text-[12px] text-primary">{r.skuCode}</Td>
                <Td mono className="text-[12px] text-ink-600">{r.channelSku}</Td>
                <Td right mono>{r.qty.toLocaleString('en-IN')}</Td>
                <Td right mono>{r.gmv.toLocaleString('en-IN')}</Td>
                <Td right mono>{r.poValue.toLocaleString('en-IN')}</Td>
                <Td right mono className={r.updatedQty < r.qty ? 'text-crit' : ''}>{r.updatedQty.toLocaleString('en-IN')}</Td>
                <Td right mono>{r.updatedGmv.toLocaleString('en-IN')}</Td>
                <Td right mono>{r.updatedPoValue.toLocaleString('en-IN')}</Td>
                <Td><span className="text-[12px] text-ink-600">{r.facility}</span></Td>
                <Td><button className="text-ink-400 hover:text-ink-900" title="Row actions">···</button></Td>
                <Td><span className="inline-flex items-center gap-1.5 text-[12px]" title={r.finalStatus}><Dot tone={finalStatusColor(r.finalStatus)} /> {r.finalStatus}</span></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-line px-3 py-2 text-[11px] text-ink-400">
        <span>Showing 1–{Math.min(pageSize, rows.length)} of {rows.length}</span>
        <div className="flex gap-1"><button className="rounded border border-line px-2 py-1">Prev</button><button className="rounded border border-line px-2 py-1">Next</button></div>
      </div>
    </Card>
  )
}

// ---- Errors subtab ----------------------------------------------------
const errTone = (t: ErrorRow['type']) => (t === 'File not readable' || t === 'Reading / processing issue' ? 'crit' : 'warn')

function ErrorsGrid() {
  const [sel, setSel] = useState<Set<string>>(new Set())
  const toggle = (po: string) => setSel((s) => { const n = new Set(s); n.has(po) ? n.delete(po) : n.add(po); return n })
  const headers = ['PO / Shipment', 'Channel', 'SKU', 'Error Type', 'Detail', 'Detected at', 'Source']
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="text-[13px] font-semibold">Failed cross-checks · validate by exception</span>
        <Button icon={<span>↓</span>} onClick={() => downloadCsv('errors.csv', headers, ERROR_QUEUE.map((e) => [e.poNo, e.channel, e.sku, e.type, e.detail, e.detectedAt, e.source]))}>Download CSV</Button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="border-b border-line bg-alt/60">
            <tr><Th><input type="checkbox" /></Th><Th>PO / Shipment</Th><Th>Channel</Th><Th>SKU</Th><Th>Error type</Th><Th>Detail</Th><Th>Detected at</Th><Th right>Action</Th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ERROR_QUEUE.map((e) => (
              <tr key={e.poNo} className="hover:bg-alt/40">
                <Td><input type="checkbox" checked={sel.has(e.poNo)} onChange={() => toggle(e.poNo)} /></Td>
                <Td mono className="text-[12px] font-medium text-primary">{e.poNo}</Td>
                <Td>{e.channel}</Td>
                <Td mono className="text-[12px] text-ink-600">{e.sku}</Td>
                <Td><Badge tone={errTone(e.type)}>{e.type}</Badge></Td>
                <Td><span className="text-[12px] text-ink-600">{e.detail}</span></Td>
                <Td mono className="text-[12px] text-ink-600">{e.detectedAt}</Td>
                <Td right><Button variant="ghost">Resolve →</Button></Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-line px-3 py-2.5">
        <span className="text-[11px] text-ink-400">{sel.size} selected · one fix can clear many rows</span>
        <Button variant="primary">Bulk resolve {sel.size > 0 ? `(${sel.size})` : ''}</Button>
      </div>
    </Card>
  )
}
