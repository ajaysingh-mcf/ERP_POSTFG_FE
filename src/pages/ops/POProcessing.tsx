import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, FileSpreadsheet, FileText, FileUp, Link2, Webhook, Zap, Mail } from 'lucide-react'
import { Badge, PageTitle, SubTabs } from '../../components/ui'
import { DataGrid, FilterPanel, SectionToolbar, exportRows, inputCls, useSection, type FilterDef } from '../../components/kit'
import { BRANDS, OPS_CHANNELS, type ColKind } from '../../lib/ops'
import { daysBefore, istDateTime, istDay } from '../../lib/time'
import { InReview } from './POReview'
import { FileCell, SourceCell } from './SourceCells'
import { DummySection } from '../../components/DummyData'
import { listPoReview, type PoReviewItem } from '../../api/poReview'
import { ApiError } from '../../api/client'
import { PO_REVIEW_MAX_PAGE_SIZE, PO_STATUS, PROCESSED_DEFAULT_DAYS, REVIEW_LIVE, SOURCE_LABELS } from '../../constants/poReview'
import { useLiveReview } from '../../lib/liveReview'
import { LiveDot } from '../../components/LiveDot'

type Tab = 'processed' | 'review' | 'manual'
const SRC_ICON = { API: Zap, Webhook: Webhook, Email: Mail, Manual: FileUp } as const

export default function POProcessing() {
  const [tab, setTab] = useState<Tab>('processed')
  const [processedCount, setProcessedCount] = useState<number | undefined>()
  const [reviewCount, setReviewCount] = useState<number | undefined>()
  // Live (2026-10-15): when anyone submits, approves, rejects, or a new PO arrives, both lists reload quietly.
  const [liveTick, setLiveTick] = useState(0)
  const live = useLiveReview(REVIEW_LIVE.PO_REVIEW_BASE, useCallback(() => setLiveTick((n) => n + 1), []))
  return (
    <div className="space-y-5">
      <PageTitle title="PO Processing & Review" sub="Ingest from channel APIs, webhooks and email · resolve parser errors · upload what can't be automated" right={<LiveDot mode={live} />} />
      <SubTabs value={tab} onChange={setTab} tabs={[
        { key: 'processed', label: 'Processed', count: processedCount },
        { key: 'review', label: 'In Review', count: reviewCount, danger: !!reviewCount },
        { key: 'manual', label: 'Manual Upload' },
      ]} />
      {tab === 'processed' && <Processed onCount={setProcessedCount} liveTick={liveTick} />}
      {tab === 'review' && <InReview srcIcon={SRC_ICON} onCount={setReviewCount} liveTick={liveTick} />}
      {tab === 'manual' && <DummySection what="Manual Upload"><Manual /></DummySection>}
    </div>
  )
}

// ---- Processed: completed POs from GET /po-review?status=completed ------------------------------

type ProcessedRow = {
  id: string; poNumber: string; channel: string; brand: string; processedAt: string
  lines: number | null; units: number | null; value: number | null; saleOrder: string; source: string; file: string
  /** Raw source value (api / email / manual) for the icon, and the subject the Source cell copies. */
  sourceKey: string; subject: string | null
}

const PCOLS: [string, keyof ProcessedRow, ColKind][] = [
  ['Ingest ID', 'id', 'mono'], ['PO Number', 'poNumber', 'mono'], ['Channel', 'channel', 'text'], ['Brand', 'brand', 'text'],
  ['Processed At', 'processedAt', 'mono'], ['Lines', 'lines', 'num'], ['Units', 'units', 'num'], ['Value', 'value', 'money'], ['Sale order', 'saleOrder', 'mono'],
]

const toRow = (r: PoReviewItem): ProcessedRow => ({
  id: r.uploadId, poNumber: r.poNumber ?? '', channel: r.channel ?? '', brand: r.brand ?? '', processedAt: istDateTime(r.completedAt),
  lines: r.lines, units: r.units, value: r.poValue, saleOrder: r.saleOrderCode ?? '', source: SOURCE_LABELS[r.source] ?? r.source, file: r.fileName, sourceKey: r.source, subject: r.subject,
})

const distinct = (rows: ProcessedRow[], k: keyof ProcessedRow) => [...new Set(rows.map((r) => String(r[k] ?? '')).filter(Boolean))].sort()

function Processed({ onCount, liveTick }: { onCount: (n: number) => void; liveTick: number }) {
  const defaultFrom = daysBefore(PROCESSED_DEFAULT_DAYS - 1)
  const today = istDay(new Date())
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(today)
  const [rows, setRows] = useState<ProcessedRow[]>([])
  const [state, setState] = useState<{ loading: boolean; error?: string }>({ loading: true })
  const [reload, setReload] = useState(0)
  // A live reload keeps the rows on screen (no "Loading…" flash); a new date range shows the loader.
  const range = useRef('')

  useEffect(() => {
    if (!from || !to || from > to) return
    const ctrl = new AbortController()
    if (range.current !== `${from}|${to}`) setState({ loading: true })
    range.current = `${from}|${to}`
    listPoReview({ status: PO_STATUS.COMPLETED, from, to, pageSize: PO_REVIEW_MAX_PAGE_SIZE }, ctrl.signal)
      .then((items) => {
        const next = items.map(toRow)
        setRows(next)
        onCount(next.length)
        setState({ loading: false })
      })
      .catch((e: unknown) => {
        if (ctrl.signal.aborted) return
        setState({ loading: false, error: e instanceof ApiError ? e.message : String(e) })
      })
    return () => ctrl.abort()
  }, [from, to, reload, liveTick, onCount])

  const s = useSection<ProcessedRow>(rows, ['poNumber', 'id', 'file', 'saleOrder'])
  const defs: FilterDef[] = [
    { key: 'channel', label: 'Channel', type: 'multi', options: distinct(rows, 'channel') },
    { key: 'brand', label: 'Brand', type: 'multi', options: distinct(rows, 'brand') },
    { key: 'source', label: 'Source', type: 'multi', options: distinct(rows, 'source') },
  ]
  const box = 'rounded-[var(--radius)] border border-line bg-surface px-4 py-10 text-center text-[13px] text-ink-600'
  return (
    <div className="space-y-3">
      <SectionToolbar q={s.q} setQ={s.setQ} placeholder="Search PO number, ingest ID, file, sale order…" filtersOpen={s.open} onToggleFilters={() => s.setOpen(!s.open)} activeFilters={s.active}
        entity="Processed POs" onExport={(e) => exportRows('processed_pos', e, PCOLS, s.filtered)}
        extra={
          <div className="flex h-9 items-center gap-1.5 rounded-[var(--radius)] border border-line bg-surface px-2 text-[12px] text-ink-600">
            <span className="hidden sm:inline">Processed</span>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="tnum bg-transparent text-[12px] text-ink-900 outline-none" />
            <span>→</span>
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="tnum bg-transparent text-[12px] text-ink-900 outline-none" />
            {(from !== defaultFrom || to !== today) && <button onClick={() => { setFrom(defaultFrom); setTo(today) }} className="ml-1 font-medium text-primary">Last {PROCESSED_DEFAULT_DAYS} days</button>}
          </div>
        } />
      {s.open && <FilterPanel defs={defs} value={s.filters} onApply={s.setFilters} onClose={() => s.setOpen(false)} />}
      {state.error ? (
        <div className="flex items-center gap-3 rounded-[var(--radius)] border border-crit/30 bg-crit-soft px-4 py-3 text-[13px] text-crit">
          <AlertTriangle className="size-4" /> Could not load processed POs: {state.error}
          <button onClick={() => setReload((n) => n + 1)} className="ml-auto font-semibold">Retry</button>
        </div>
      ) : state.loading ? (
        <div className={box}>Loading processed POs…</div>
      ) : !rows.length ? (
        <div className={box}>No POs were processed between {from} and {to}.</div>
      ) : (
        <DataGrid cols={PCOLS} rows={s.filtered} rowKey={(r) => r.id}
          trailing={[
            { label: 'Source', render: (r) => <SourceCell source={r.source} subject={r.subject} fallback={r.poNumber} icon={SRC_ICON[r.source as keyof typeof SRC_ICON] ?? Mail} /> },
            { label: 'Original file', render: (r) => <FileCell uploadId={r.id} name={r.file} /> },
          ]} />
      )}
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
