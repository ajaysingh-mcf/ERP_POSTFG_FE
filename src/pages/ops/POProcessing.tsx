import { useCallback, useEffect, useRef, useState } from 'react'
import { useChannelOptions } from '../../lib/channels'
import { AlertTriangle, FileSpreadsheet, FileText, FileUp, Link2, Webhook, Zap, Mail } from 'lucide-react'
import { Badge, PageTitle, SubTabs } from '../../components/ui'
import { DataGrid, FilterChips, FilterPanel, SectionToolbar, exportRows, inputCls, useSection, type FilterDef } from '../../components/kit'
import { Reveal } from '../../components/shell'
import { BRANDS, OPS_CHANNELS, type ColKind } from '../../lib/ops'
import { daysBefore, istDateTime, istDay } from '../../lib/time'
import { InReview } from './POReview'
import { FileCell, SourceCell } from './SourceCells'
import { UniwareCell, ageTone, daysWaiting, downloadCombinedCsv, downloadOneCsv, stateOf, type Handoff } from './UniwareHandoff'
import { markUniwareUploaded } from '../../api/poReview'
import { UNIWARE_STATE, UNIWARE_STATE_LABEL, UNIWARE_TEXT } from '../../constants/poReview'
import { useAuth } from '../../auth/AuthContext'
import { ACCESS } from '../../constants/auth'
import { PATHS } from '../../constants/pages'
import { Check, Download as DownloadIcon, Upload as UploadIcon, X as XIcon } from 'lucide-react'
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
  /** Uniware hand-off: the raw dates / names, its state label (filter + export) and days waiting. */
  handoff: Handoff; uniware: string; waitingDays: number
}

const PCOLS: [string, keyof ProcessedRow, ColKind][] = [
  // Ingest ID left out of the screen and the download (user, 2026-10-16); rows still use it as their key.
  ['PO Number', 'poNumber', 'mono'], ['Channel', 'channel', 'text'], ['Brand', 'brand', 'text'],
  ['Processed At', 'processedAt', 'mono'], ['Lines', 'lines', 'num'], ['Units', 'units', 'num'], ['Value', 'value', 'money'], ['Sale order', 'saleOrder', 'mono'],
]
/** The download (CSV / Excel of the table) also says where each PO stands with Uniware. */
const PEXPORT: [string, keyof ProcessedRow, ColKind][] = [...PCOLS, ['Uniware', 'uniware', 'text']]

const handoffOf = (r: PoReviewItem): Handoff => ({
  id: r.uploadId, completedAt: r.completedAt, csvDownloadedAt: r.csvDownloadedAt, csvDownloadedBy: r.csvDownloadedBy,
  uniwareUploadedAt: r.uniwareUploadedAt, uniwareUploadedBy: r.uniwareUploadedBy,
})

const toRow = (r: PoReviewItem): ProcessedRow => ({
  handoff: handoffOf(r), uniware: UNIWARE_STATE_LABEL[stateOf(handoffOf(r))], waitingDays: daysWaiting(handoffOf(r)),
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
  const { accessFor } = useAuth()
  const canEdit = accessFor(PATHS.PO_REVIEW) === ACCESS.EDITOR
  const [note, setNote] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)
  const [bulkBusy, setBulkBusy] = useState(false)
  const done = (text: string) => { setNote({ tone: 'ok', text }); setReload((n) => n + 1) }
  const fail = (text: string) => setNote({ tone: 'err', text })
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
  // Ticked rows (by id): CSV / Excel download only these; none ticked = every row shown. Rows that left the list drop out.
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const picked = rows.filter((r) => selected.has(r.id))
  const channelOptions = useChannelOptions(distinct(rows, 'channel'))
  const defs: FilterDef[] = [
    { key: 'channel', label: 'Channel', type: 'multi', options: channelOptions },
    { key: 'brand', label: 'Brand', type: 'multi', options: distinct(rows, 'brand') },
    { key: 'source', label: 'Source', type: 'multi', options: distinct(rows, 'source') },
    { key: 'uniware', label: 'Uniware', type: 'multi', options: Object.values(UNIWARE_STATE_LABEL) },
  ]
  const pending = rows.filter((r) => stateOf(r.handoff) === UNIWARE_STATE.PENDING).length
  const waiting = rows.filter((r) => stateOf(r.handoff) === UNIWARE_STATE.DOWNLOADED).length
  // Bulk: the ticked POs as ONE combined CSV, or marked uploaded (only the downloaded, not-yet-uploaded ones).
  const markable = picked.filter((r) => stateOf(r.handoff) === UNIWARE_STATE.DOWNLOADED)
  const bulk = async (what: 'csv' | 'mark') => {
    setBulkBusy(true)
    try {
      // One ticked PO: its own file named after the sale order; several: one combined CSV.
      if (what === 'csv') { await (picked.length === 1 ? downloadOneCsv(picked[0].id) : downloadCombinedCsv(picked.map((r) => r.id))); done(UNIWARE_TEXT.DOWNLOADED(picked.length)) }
      else { await markUniwareUploaded(markable.map((r) => r.id)); done(UNIWARE_TEXT.MARKED(markable.length)) }
    } catch (e) {
      fail(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBulkBusy(false)
    }
  }
  const box = 'rounded-[var(--radius)] border border-line bg-surface px-4 py-10 text-center text-[13px] text-ink-600'
  return (
    <div className="space-y-3">
      <SectionToolbar q={s.q} setQ={s.setQ} placeholder="Search PO number, ingest ID, file, sale order…" filtersOpen={s.open} onToggleFilters={() => s.setOpen(!s.open)} activeFilters={s.active}
        entity="Processed POs" onExport={(e) => exportRows('processed_pos', e, PEXPORT, picked.length ? picked : s.filtered)}
        primary={canEdit && picked.length > 0 ? (
          <span className="pf-tab-in inline-flex gap-2">
            <button onClick={() => void bulk('csv')} disabled={bulkBusy} className="pf-press inline-flex h-9 items-center gap-1.5 rounded-[var(--radius)] bg-primary px-3 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-60">
              <DownloadIcon className="size-4" />{UNIWARE_TEXT.BULK_DOWNLOAD(picked.length)}
            </button>
            {markable.length > 0 && (
              <button onClick={() => void bulk('mark')} disabled={bulkBusy} className="pf-press inline-flex h-9 items-center gap-1.5 rounded-[var(--radius)] bg-ok px-3 text-[13px] font-semibold text-white hover:opacity-90 disabled:opacity-60">
                <UploadIcon className="size-4" />{UNIWARE_TEXT.BULK_MARK(markable.length)}
              </button>
            )}
          </span>
        ) : undefined}
        selectedCount={picked.length} onClearSelection={() => setSelected(new Set())}
        extra={
          <div className="flex h-9 items-center gap-1.5 rounded-[var(--radius)] border border-line bg-surface px-2 text-[12px] text-ink-600">
            <span className="hidden sm:inline">Processed</span>
            <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} className="tnum bg-transparent text-[12px] text-ink-900 outline-none" />
            <span>→</span>
            <input type="date" value={to} min={from} onChange={(e) => setTo(e.target.value)} className="tnum bg-transparent text-[12px] text-ink-900 outline-none" />
          </div>
        } />
      <Reveal open={s.open}><FilterPanel defs={defs} value={s.filters} onApply={s.setFilters} onClose={() => s.setOpen(false)} /></Reveal>
      {!s.open && <FilterChips defs={defs} value={s.filters} onChange={s.setFilters} />}
      {/* What still has to go to Uniware: click to show only those. */}
      {(pending > 0 || waiting > 0) && (
        <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
          {pending > 0 && <button onClick={() => s.setFilters({ ...s.filters, uniware: [UNIWARE_STATE_LABEL.pending] })} className="pf-press rounded-full bg-warn-soft px-3 py-1 font-semibold text-warn hover:opacity-90">{pending} not downloaded</button>}
          {waiting > 0 && <button onClick={() => s.setFilters({ ...s.filters, uniware: [UNIWARE_STATE_LABEL.downloaded] })} className="pf-press rounded-full bg-info-soft px-3 py-1 font-semibold text-info hover:opacity-90">{waiting} downloaded, not in Uniware</button>}
          <span className="text-ink-400">These stay here, whatever the dates, until they are marked uploaded; then they show in PO Overview.</span>
        </div>
      )}
      {note && (
        <div className={`pf-tab-in flex items-start gap-2 rounded-[var(--radius)] px-3 py-2 text-[12.5px] ${note.tone === 'ok' ? 'bg-ok-soft text-ok' : 'bg-crit-soft text-crit'}`}>
          {note.tone === 'ok' ? <Check className="mt-0.5 size-4 shrink-0" /> : <AlertTriangle className="mt-0.5 size-4 shrink-0" />}
          <span className="flex-1">{note.text}</span>
          <button onClick={() => setNote(null)}><XIcon className="size-4" /></button>
        </div>
      )}
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
        <DataGrid cols={PCOLS} rows={s.filtered} rowKey={(r) => r.id} selected={selected} onSelectedChange={setSelected}
          // As PO Working's critical rows: a thin stripe on the row's left edge while it is not in Uniware (red 10+ days, yellow 5+).
          rowClass={(r) => {
            if (stateOf(r.handoff) === UNIWARE_STATE.UPLOADED) return ''
            const tone = ageTone(r.waitingDays)
            return tone === 'crit' ? '[&>td:first-child]:shadow-[inset_3px_0_0_var(--color-crit)]' : tone === 'warn' ? '[&>td:first-child]:shadow-[inset_3px_0_0_var(--color-warn)]' : ''
          }}
          trailing={[
            { label: 'Source', render: (r) => <SourceCell source={r.source} subject={r.subject} fallback={r.poNumber} icon={SRC_ICON[r.source as keyof typeof SRC_ICON] ?? Mail} /> },
            { label: 'Original file', render: (r) => <FileCell uploadId={r.id} name={r.file} /> },
            {
              label: UNIWARE_TEXT.COLUMN, render: (r) => <UniwareCell h={r.handoff} canEdit={canEdit} onDone={done} onError={fail} />,
              // ↓ = waiting longest first (not downloaded before downloaded on the same day), POs already in Uniware last.
              sortValue: (r) => (stateOf(r.handoff) === UNIWARE_STATE.UPLOADED ? -1 : r.waitingDays * 2 + (stateOf(r.handoff) === UNIWARE_STATE.PENDING ? 1 : 0)),
              sortHint: UNIWARE_TEXT.SORT_HINT,
            },
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
