import { useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Check, Download, Minus, Plus, Printer, RotateCw, X, FileSpreadsheet, FileText, FileUp, Link2, Webhook, Zap, Mail } from 'lucide-react'
import { Badge, Button, PageTitle, SubTabs } from '../../components/ui'
import { DataGrid, FilterPanel, SectionToolbar, exportRows, inputCls, useSection, type FilterDef } from '../../components/kit'
import { BRANDS, OPS_CHANNELS, PROCESSED_POS, REVIEW_POS, TODAY, type ColKind, type ProcessedPO, type ReviewPO } from '../../lib/ops'

type Tab = 'processed' | 'review' | 'manual'
const SRC_ICON = { API: Zap, Webhook: Webhook, Email: Mail, Manual: FileUp } as const
const shift = (n: number) => { const d = new Date(TODAY); d.setDate(d.getDate() - n); return d.toISOString().slice(0, 10) }

export default function POProcessing() {
  const [tab, setTab] = useState<Tab>('processed')
  const [processed, setProcessed] = useState<ProcessedPO[]>(PROCESSED_POS)
  const [review, setReview] = useState<ReviewPO[]>(REVIEW_POS)
  const markProcessed = (r: ReviewPO) => {
    setReview((v) => v.filter((x) => x.id !== r.id))
    setProcessed((p) => [{ id: r.id, poNumber: r.poNumber, channel: r.channel, brand: r.brand, source: r.source, processedAt: `${TODAY} 10:${String(p.length % 60).padStart(2, '0')}`, lines: r.fields.length, units: 0, value: 0, file: r.file, parser: 'Reviewed' }, ...p])
  }
  return (
    <div className="space-y-5">
      <PageTitle title="PO Processing & Review" sub="Ingest from channel APIs, webhooks and email · resolve parser errors · upload what can't be automated" />
      <SubTabs value={tab} onChange={setTab} tabs={[
        { key: 'processed', label: 'Processed', count: processed.length },
        { key: 'review', label: 'In Review', count: review.length, danger: review.length > 0 },
        { key: 'manual', label: 'Manual Upload' },
      ]} />
      {tab === 'processed' && <Processed rows={processed} />}
      {tab === 'review' && <Review rows={review} onDone={markProcessed} />}
      {tab === 'manual' && <Manual />}
    </div>
  )
}

const PCOLS: [string, keyof ProcessedPO, 'mono' | 'text' | 'num' | 'money'][] = [
  ['Ingest ID', 'id', 'mono'], ['PO Number', 'poNumber', 'mono'], ['Channel', 'channel', 'text'], ['Brand', 'brand', 'text'],
  ['Processed At', 'processedAt', 'mono'], ['Lines', 'lines', 'num'], ['Units', 'units', 'num'], ['Value', 'value', 'money'], ['Parser', 'parser', 'text'],
]

function Processed({ rows }: { rows: ProcessedPO[] }) {
  const [from, setFrom] = useState(shift(2))
  const [to, setTo] = useState(TODAY)
  const ranged = useMemo(() => rows.filter((r) => r.processedAt.slice(0, 10) >= from && r.processedAt.slice(0, 10) <= to), [rows, from, to])
  const s = useSection<ProcessedPO>(ranged, ['poNumber', 'id', 'file'])
  const defs: FilterDef[] = [
    { key: 'channel', label: 'Channel', type: 'multi', options: OPS_CHANNELS },
    { key: 'brand', label: 'Brand', type: 'multi', options: BRANDS },
    { key: 'source', label: 'Source', type: 'multi', options: ['API', 'Webhook', 'Email', 'Manual'] },
  ]
  return (
    <div className="space-y-3">
      <SectionToolbar q={s.q} setQ={s.setQ} placeholder="Search PO number, ingest ID, file…" filtersOpen={s.open} onToggleFilters={() => s.setOpen(!s.open)} activeFilters={s.active}
        entity="Processed POs" onExport={(e) => exportRows('processed_pos', e, PCOLS, s.filtered)}
        extra={
          <div className="flex h-9 items-center gap-1.5 rounded-[var(--radius)] border border-line bg-surface px-2 text-[12px] text-ink-600">
            <span className="hidden sm:inline">Processed</span>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="tnum bg-transparent text-[12px] text-ink-900 outline-none" />
            <span>→</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="tnum bg-transparent text-[12px] text-ink-900 outline-none" />
            {from !== shift(2) && <button onClick={() => { setFrom(shift(2)); setTo(TODAY) }} className="ml-1 font-medium text-primary">Last 3 days</button>}
          </div>
        } />
      {s.open && <FilterPanel defs={defs} value={s.filters} onApply={s.setFilters} onClose={() => s.setOpen(false)} />}
      <DataGrid cols={PCOLS} rows={s.filtered} rowKey={(r) => r.id}
        trailing={[
          { label: 'Source', render: (r) => { const I = SRC_ICON[r.source]; return <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-600"><I className="size-3.5" />{r.source}</span> } },
          { label: 'Original file', render: (r) => <a href="#" onClick={(e) => e.preventDefault()} className="inline-flex items-center gap-1 text-primary hover:underline"><Link2 className="size-3.5" /><span className="font-mono text-[12px]">{r.file}</span></a> },
        ]} />
    </div>
  )
}

type RLine = { sr: number; sku: string; channelSku: string; name: string; qty: number; mrp: number; rate: number; err?: string }
const reviewLines = (r: ReviewPO): RLine[] => {
  const skuErr = r.fields.find((f) => /SKU/.test(f.field) && f.error)
  const mrpErr = r.fields.find((f) => f.field === 'MRP' && f.error)
  return [
    { sr: 1, sku: skuErr ? '' : 'MCF-VITC-30', channelSku: skuErr?.parsed ?? `${r.channel.slice(0, 3).toUpperCase()}-88202`, name: 'Vitamin C Face Serum 30ml', qty: 600, mrp: 699, rate: 489.3, err: skuErr?.error },
    { sr: 2, sku: 'HYP-SUNSCR-50', channelSku: `${r.channel.slice(0, 3).toUpperCase()}-41100`, name: 'SPF 50 Sunscreen 50ml', qty: 240, mrp: mrpErr ? Number(mrpErr.parsed) : 449, rate: 314.3, err: mrpErr ? `MRP ${mrpErr.parsed} ≠ master ${mrpErr.expected}` : undefined },
  ]
}

const RCOLS: [string, keyof ReviewPO, ColKind][] = [['Ingest ID', 'id', 'mono'], ['PO Number', 'poNumber', 'mono'], ['Channel', 'channel', 'text'], ['Brand', 'brand', 'text'], ['Received At', 'receivedAt', 'mono']]

function Review({ rows, onDone }: { rows: ReviewPO[]; onDone: (r: ReviewPO) => void }) {
  const [sel, setSel] = useState<ReviewPO | null>(null)
  const s = useSection<ReviewPO>(rows, ['poNumber', 'id', 'channel'])
  const defs: FilterDef[] = [
    { key: 'channel', label: 'Channel', type: 'multi', options: OPS_CHANNELS },
    { key: 'brand', label: 'Brand', type: 'multi', options: BRANDS },
    { key: 'source', label: 'Source', type: 'multi', options: ['API', 'Webhook', 'Email', 'Manual'] },
  ]
  return (
    <div className="space-y-3">
      <SectionToolbar q={s.q} setQ={s.setQ} placeholder="Search PO number, ingest ID, channel…" filtersOpen={s.open} onToggleFilters={() => s.setOpen(!s.open)} activeFilters={s.active}
        entity="In-review POs" onExport={(e) => exportRows('in_review', e, RCOLS, s.filtered)} />
      {s.open && <FilterPanel defs={defs} value={s.filters} onApply={s.setFilters} onClose={() => s.setOpen(false)} />}
      <DataGrid cols={RCOLS} rows={s.filtered} rowKey={(r) => r.id} onRowClick={setSel}
        rowClass={() => '[&>td:first-child]:shadow-[inset_3px_0_0_var(--color-crit)]'}
        trailing={[
          { label: 'Issues', render: (r) => <span className="flex gap-1">{r.labels.map((l) => <Badge key={l} tone="crit">{l}</Badge>)}</span> },
          { label: 'Fields flagged', render: (r) => <span className="tnum text-crit">{r.fields.filter((f) => f.error).length}</span> },
          { label: 'Source', render: (r) => { const I = SRC_ICON[r.source]; return <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-600"><I className="size-3.5" />{r.source}</span> } },
          { label: 'Original file', render: (r) => <span className="inline-flex items-center gap-1 font-mono text-[12px] text-primary"><Link2 className="size-3.5" />{r.file}</span> },
          { label: '', render: () => <span className="text-[12px] font-semibold text-primary">Review →</span> },
        ]} />
      {sel && <ReviewPanel po={sel} onClose={() => setSel(null)} onDone={() => { onDone(sel); setSel(null) }} />}
    </div>
  )
}

function ReviewPanel({ po, onClose, onDone }: { po: ReviewPO; onClose: () => void; onDone: () => void }) {
  const fv = (k: string) => po.fields.find((f) => f.field === k)
  const [vals, setVals] = useState<Record<string, string>>(() => Object.fromEntries(po.fields.map((f) => [f.field, f.expected ?? f.parsed])))
  const [lines, setLines] = useState<RLine[]>(() => reviewLines(po))
  const [zoom, setZoom] = useState(80)
  const [pg, setPg] = useState(1)
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', k)
    return () => document.removeEventListener('keydown', k)
  }, [onClose])

  const total = lines.reduce((a, l) => a + l.qty * l.rate, 0)
  const unresolved = lines.filter((l) => !l.sku).length + po.fields.filter((f) => f.error && !/SKU|MRP/.test(f.field) && vals[f.field] === f.parsed).length
  const checks = [
    { ok: !fv('Customer code')?.error, label: 'Customer matched' },
    { ok: lines.every((l) => l.sku), label: `${lines.filter((l) => l.sku).length} of ${lines.length} SKUs matched` },
    { ok: !fv('Facility')?.error, label: 'Facility resolved' },
  ]
  const lab = 'mb-1 block text-[12px] font-medium text-ink-900'
  const Sec = ({ children }: { children: string }) => <div className="mb-3 mt-5 flex items-center gap-3 font-serif text-[12px] uppercase tracking-[0.08em] text-ink-600 first:mt-0">{children}<span className="h-px flex-1 bg-line" /></div>
  const inp = ({ k, label, req, fallback = '', mono }: { k: string; label: string; req?: boolean; fallback?: string; mono?: boolean }) => {
    const f = fv(k)
    const bad = f?.error && vals[k] === f.parsed
    return (
      <label className="block">
        <span className={lab}>{label}{req && <span className="text-crit"> *</span>}</span>
        <input value={vals[k] ?? fallback} onChange={(e) => setVals({ ...vals, [k]: e.target.value })} className={`${inputCls} ${mono ? 'font-mono' : ''} ${bad ? 'border-crit/60 bg-crit-soft' : ''}`} />
        {f?.error && <span className={`mt-1 block text-[11px] ${bad ? 'text-crit' : 'text-ink-400'}`}>PO says: <b className="font-mono">{f.parsed}</b>{bad && ` — ${f.error}`}</span>}
      </label>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-surface">
      <div className="flex items-start justify-between border-b border-line px-5 py-3">
        <div>
          <div className="flex items-baseline gap-2">
            <h2 className="font-serif text-[22px] font-medium">Review</h2>
            <span className="font-mono text-[15px] text-primary">{po.poNumber}</span>
            <span className="font-serif text-[14px] text-ink-600">{lines.length} line items</span>
          </div>
          <p className="text-[12px] text-ink-600">Check the parsed fields against the original, correct anything wrong, then create the PO.</p>
        </div>
        <button onClick={onClose} className="rounded-md p-1.5 text-ink-400 hover:bg-alt hover:text-ink-900"><X className="size-5" /></button>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-2">
        {/* Document viewer */}
        <div className="hidden min-h-0 flex-col p-3 lg:flex">
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-card)] bg-[#323639]">
            <div className="flex items-center gap-4 px-4 py-2.5 text-[13px] text-white/90">
              <FileText className="size-4" />
              <span className="max-w-[180px] truncate font-medium">{po.file}</span>
              <span className="flex items-center gap-1.5"><button onClick={() => setPg(Math.max(1, pg - 1))} className="rounded bg-black/30 px-2 tnum">{pg}</button>/ 2</span>
              <span className="h-5 w-px bg-white/20" />
              <button onClick={() => setZoom(Math.max(50, zoom - 10))}><Minus className="size-4" /></button>
              <span className="tnum rounded bg-black/30 px-2">{zoom}%</span>
              <button onClick={() => setZoom(Math.min(150, zoom + 10))}><Plus className="size-4" /></button>
              <span className="h-5 w-px bg-white/20" />
              <RotateCw className="size-4 opacity-80" />
              <span className="ml-auto flex items-center gap-4 opacity-80"><Download className="size-4" /><Printer className="size-4" /></span>
            </div>
            <div className="min-h-0 flex-1 overflow-auto bg-[#525659] p-5">
              <div className="mx-auto origin-top bg-white p-8 text-[11px] leading-snug text-black shadow-xl" style={{ width: 620, transform: `scale(${zoom / 100})` }}>
                <div className="flex items-start justify-between">
                  <div><div className="text-[15px] font-bold">PURCHASE ORDER</div><div className="mt-1">{po.channel} — {po.brand === 'Hyphen' ? 'Hyphen' : 'mCaffeine'} supply</div></div>
                  <div className="text-right"><div className="font-bold">PO No: {po.poNumber}</div><div>PO Date: {fv('PO Date')?.parsed ?? '04-10-2026'}</div><div>Expiry: 12-10-2026</div></div>
                </div>
                <div className="mt-4 grid grid-cols-2 border border-black">
                  <div className="border-r border-black p-2"><b>Vendor</b><br />Pep Technologies Pvt Ltd<br />3,11,19,20 Pragati Industrial Logistic Park, Gurugram<br />GSTIN: 06AAICP2804J1ZG</div>
                  <div className="p-2"><b>Ship To</b><br />{po.channel} {fv('Delivery location')?.parsed ?? 'Fulfilment Centre'}<br />Pincode: {fv('Pincode')?.parsed ?? '421302'}<br />Customer: {fv('Customer code')?.parsed ?? 'C-232042'}</div>
                </div>
                <table className="mt-4 w-full border-collapse border border-black">
                  <thead><tr className="bg-gray-100">{['Sl', 'Article / Channel SKU', 'Description', 'Qty', 'MRP', 'Rate', 'Amount'].map((h) => <th key={h} className="border border-black p-1 text-left">{h}</th>)}</tr></thead>
                  <tbody>{reviewLines(po).map((l) => (
                    <tr key={l.sr}>{[l.sr, l.channelSku, l.name, l.qty, l.mrp, l.rate, (l.qty * l.rate).toFixed(2)].map((v, i) => <td key={i} className="border border-black p-1">{v}</td>)}</tr>
                  ))}</tbody>
                </table>
                <div className="mt-3 text-right font-bold">Total: ₹{reviewLines(po).reduce((a, l) => a + l.qty * l.rate, 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                <div className="mt-10 text-[10px] text-gray-500">Terms: Deliver against appointment only. Shortfall beyond 5% may lead to PO cancellation.</div>
              </div>
            </div>
          </div>
        </div>

        {/* Parsed form */}
        <div className="min-h-0 overflow-y-auto px-5 py-4">
          <Sec>Purchase order</Sec>
          <div className="grid gap-3 sm:grid-cols-3">
            {inp({ k: "PO Number", label: "PO Number", req: true, mono: true, fallback: po.poNumber, })}
            {inp({ k: "PO Date", label: "PO Date", fallback: "04-10-2026", })}
            <label className="block"><span className={lab}>PO Expiry</span><input defaultValue="12-10-2026" className={inputCls} /></label>
            <label className="block"><span className={lab}>Channel <span className="text-crit">*</span></span><select defaultValue={po.channel} className={inputCls}>{OPS_CHANNELS.map((c) => <option key={c}>{c}</option>)}</select></label>
            <label className="block"><span className={lab}>Brand</span><select defaultValue={po.brand} className={inputCls}>{BRANDS.map((b) => <option key={b}>{b}</option>)}</select></label>
            <label className="block"><span className={lab}>Currency</span><input defaultValue="INR" className={inputCls} /></label>
          </div>

          <Sec>Where it's going</Sec>
          <div className="grid gap-3 sm:grid-cols-2">
            {inp({ k: "Customer code", label: "Customer code", req: true, mono: true, fallback: "C-232042", })}
            {inp({ k: "Delivery location", label: "Delivery location", fallback: "Fulfilment Centre", })}
            {inp({ k: "Pincode", label: "Pincode", mono: true, fallback: "421302", })}
            {inp({ k: "Facility", label: "Fulfilment facility", req: true, mono: true, fallback: "MUM_WAREHOUSE2", })}
          </div>

          <Sec>Line items</Sec>
          <div className="overflow-x-auto rounded-[var(--radius)] border border-line">
            <table className="w-full text-[12.5px]">
              <thead className="bg-alt"><tr>{['#', 'Channel SKU', 'Internal SKU', 'Qty', 'MRP', 'Rate'].map((h) => <th key={h} className="px-2.5 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-600">{h}</th>)}</tr></thead>
              <tbody>
                {lines.map((l, i) => {
                  const upd = (p: Partial<RLine>) => setLines(lines.map((x, j) => (j === i ? { ...x, ...p } : x)))
                  return (
                    <tr key={l.sr} className={`border-t border-line ${l.err && (!l.sku || l.err.startsWith('MRP')) ? 'bg-crit-soft/50' : ''}`}>
                      <td className="tnum px-2.5 py-2 text-ink-400">{l.sr}</td>
                      <td className="px-2.5 py-2 font-mono">{l.channelSku}</td>
                      <td className="px-2.5 py-2">
                        <select value={l.sku} onChange={(e) => upd({ sku: e.target.value })} className={`h-8 rounded-md border bg-surface px-2 font-mono text-[12px] ${l.sku ? 'border-line' : 'border-crit/60'}`}>
                          <option value="">Map SKU…</option>{['MCF-VITC-30', 'HYP-SUNSCR-50', 'MCF-FACEWASH', 'HYP-NIAC-30', 'MCF-COFF-100'].map((k) => <option key={k}>{k}</option>)}
                        </select>
                        {l.err && <div className="mt-1 text-[11px] text-crit">{l.err}</div>}
                      </td>
                      <td className="px-2.5 py-2"><input type="number" value={l.qty} onChange={(e) => upd({ qty: Number(e.target.value) })} className="tnum h-8 w-20 rounded-md border border-line px-2" /></td>
                      <td className="px-2.5 py-2"><input type="number" value={l.mrp} onChange={(e) => upd({ mrp: Number(e.target.value) })} className="tnum h-8 w-20 rounded-md border border-line px-2" /></td>
                      <td className="tnum px-2.5 py-2">{l.rate}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-2 text-right text-[12px] text-ink-600">Lines total <span className="tnum font-semibold text-ink-900">₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
        {checks.map((c) => (
          <span key={c.label} className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[12px] ${c.ok ? 'border-ok/30 bg-ok-soft text-ok' : 'border-crit/30 bg-crit-soft text-crit'}`}>
            {c.ok ? <Check className="size-3.5" /> : <AlertTriangle className="size-3.5" />}{c.label}
          </span>
        ))}
        {unresolved > 0 && <span className="inline-flex items-center gap-1 rounded-md border border-warn/30 bg-warn-soft px-2 py-1 text-[12px] text-warn"><AlertTriangle className="size-3.5" />{unresolved} to fix before the PO can be created</span>}
        <div className="ml-auto flex gap-2">
          <Button onClick={onClose}>Save draft</Button>
          <Button variant="primary" onClick={() => unresolved === 0 && onDone()}>{unresolved ? `Resolve ${unresolved} issue${unresolved > 1 ? 's' : ''}` : 'Create PO & mark processed'}</Button>
        </div>
      </div>
    </div>
  )
}

function Manual() {
  const [files, setFiles] = useState<{ name: string; kind: 'csv' | 'pdf'; status: 'Queued' | 'Parsing' | 'Sent to review' }[]>([
    { name: 'reliance_tira_PO_8812.pdf', kind: 'pdf', status: 'Sent to review' },
  ])
  const add = (list: FileList | null, kind: 'csv' | 'pdf') => list && setFiles((f) => [...[...list].map((x) => ({ name: x.name, kind, status: 'Queued' as const })), ...f])
  const Zone = ({ kind, Icon, title, hint, accept }: { kind: 'csv' | 'pdf'; Icon: typeof FileText; title: string; hint: string; accept: string }) => (
    <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] border-2 border-dashed border-line bg-surface px-6 py-12 text-center transition-colors hover:border-primary hover:bg-primary-soft/40">
      <div className="flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary"><Icon className="size-5" /></div>
      <div className="text-[14px] font-semibold">{title}</div>
      <div className="max-w-xs text-[12px] text-ink-400">{hint}</div>
      <input type="file" accept={accept} multiple className="hidden" onChange={(e) => add(e.target.files, kind)} />
    </label>
  )
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <select className={inputCls}><option>Channel…</option>{OPS_CHANNELS.map((c) => <option key={c}>{c}</option>)}<option>Reliance / Tira</option></select>
          <select className={inputCls}>{BRANDS.map((b) => <option key={b}>{b}</option>)}</select>
          <select className={inputCls}><option>Auto-detect format</option><option>Channel template</option><option>Post FG standard CSV</option></select>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <Zone kind="csv" Icon={FileSpreadsheet} title="Upload CSV / Excel" hint="Post FG standard columns or the channel's export. PO numbers kept as text." accept=".csv,.xlsx" />
          <Zone kind="pdf" Icon={FileText} title="Upload PO PDF" hint="Scanned or digital PDFs are OCR-parsed. Low-confidence fields go to In Review." accept=".pdf" />
        </div>
      </div>
      <div className="rounded-[var(--radius-card)] border border-line bg-surface">
        <div className="border-b border-line px-4 py-3 text-[13px] font-semibold">Upload queue</div>
        <ul className="divide-y divide-line">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-3 px-4 py-3">
              {f.kind === 'pdf' ? <FileText className="size-4 text-crit" /> : <FileSpreadsheet className="size-4 text-ok" />}
              <span className="min-w-0 flex-1 truncate font-mono text-[12px]">{f.name}</span>
              {f.status === 'Queued' ? (
                <button onClick={() => setFiles((v) => v.map((x, j) => (j === i ? { ...x, status: 'Sent to review' } : x)))} className="text-[12px] font-semibold text-primary">Process</button>
              ) : <Badge tone="warn">{f.status}</Badge>}
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-4 py-3 text-[12px] text-ink-400">Manual POs need approval before they enter PO Working.</p>
      </div>
    </div>
  )
}
