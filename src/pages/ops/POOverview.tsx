import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, Boxes, Database, Pencil, PencilLine, Upload } from 'lucide-react'
import { Drawer, Button, PageTitle } from '../../components/ui'
import { DataGrid, Field, FilterPanel, SectionToolbar, exportRows, countActive, Cell, type FilterDef, type FilterValues } from '../../components/kit'
import { PO_LINE_COLS, type ColKind, type POLineRow } from '../../lib/ops'
import { ApiError } from '../../api/client'
import { getColumns, getFilterOptions, listLines, listShipments, type ColumnDef, type FilterOptions, type LineItem, type ListParams, type PoOverviewColumns, type ShipmentItem, type TeamColumns } from '../../api/poOverview'
import { COLUMN_GROUP_LABEL, NOT_ASSIGNED_DATES, OVERVIEW_TAB, PO_OVERVIEW_PAGE_SIZE, SEARCH_DELAY_MS } from '../../constants/poOverview'
import { NOT_AVAILABLE_YET } from '../../constants/masters'

/*
 * PO Overview from the backend (GET /po-overview/shipments, /lines, /filter-options, /columns): our POs, filtered and
 * paged on the server (200 per request, "Load more" for the next). Shipment Status: an Overview tab (every column) and
 * one tab per team with that team's columns (GET /po-overview/columns, workflow order); the person's editable teams
 * come right after Overview, tinted in the primary colour, each tab keeps its workflow step number. Line columns stay
 * the design's (lib/ops PO_LINE_COLS). Saving has no backend yet: buttons disabled.
 */

type LineRow = Record<keyof POLineRow, string | number | null>

const lineRow = (l: LineItem): LineRow => ({
  shipmentUid: l.shipmentUid, entryDate: l.entryDate, brand: l.brandName, channel: l.channel, location: l.location, poDate: l.poDate,
  poNumber: l.poNumber, srNo: l.srNo, skuName: l.skuName, skuCode: l.skuCode, channelSkuCode: l.channelSkuCode, quantity: l.qty, gmv: l.gmv,
  poValue: l.poValue, updatedQuantity: l.updatedQty, updatedGmv: l.updatedGmv, updatedPoValue: l.updatedPoValue, facility: l.facility,
  productWeight: l.productWeightG, workingDate: l.workingDatePlanner, dispatchDate: l.dispatchDate, currentApptDate: l.currentAppointmentDate,
  statusPlanning: l.statusPlanning, statusWarehouse: l.statusWarehouse, statusLogistics: l.statusLogistics, status: l.statusFinal,
})

/** Filter keys = the API's query names, so the panel's values go to the server as they are. */
const multi = (key: string, label: string, options: readonly string[]): FilterDef => ({ key, label, type: 'multi', options, placeholder: `Select ${label.toLowerCase()}` })
const commonFilters = (o: FilterOptions | null): FilterDef[] => {
  const opt = (k: keyof Omit<FilterOptions, 'notAssigned'>) => (o ? [...o[k], o.notAssigned] : [])
  return [
    multi('brand', 'Brand', opt('brand')), multi('channel', 'Channel', opt('channel')), multi('facility', 'Facility', opt('facility')),
    multi('location', 'Location', opt('location')), multi('statusPlanning', 'Status Planning', opt('statusPlanning')),
    multi('statusWarehouse', 'Status Warehouse', opt('statusWarehouse')), multi('statusLogistics', 'Status Logistics', opt('statusLogistics')),
    multi('statusFinal', 'Final Status', opt('statusFinal')),
  ]
}
const shipFilters = (o: FilterOptions | null): FilterDef[] => [
  multi('notAssigned', 'Not Assigned Dates', NOT_ASSIGNED_DATES),
  { key: 'poDateFrom', label: 'PO Date From', type: 'date' }, { key: 'poDateTo', label: 'PO Date To', type: 'date' },
  { key: 'workingDateFrom', label: 'Working Date From', type: 'date' }, { key: 'workingDateTo', label: 'Working Date To', type: 'date' },
  { key: 'dispatchDateFrom', label: 'Dispatch Date From', type: 'date' }, { key: 'dispatchDateTo', label: 'Dispatch Date To', type: 'date' },
  { key: 'appointmentDateFrom', label: 'Current Appt From', type: 'date' }, { key: 'appointmentDateTo', label: 'Current Appt To', type: 'date' },
  ...commonFilters(o),
  multi('transporter', 'Transporter Name', o ? [...o.transporter, o.notAssigned] : []),
  { key: 'docketNo', label: 'Search Docket No', type: 'text', placeholder: 'e.g. DL48213…' },
]
const lineFilters = (o: FilterOptions | null): FilterDef[] => [
  { key: 'poDateFrom', label: 'PO Date From', type: 'date' }, { key: 'poDateTo', label: 'PO Date To', type: 'date' },
  { key: 'workingDateFrom', label: 'Working Date From', type: 'date' }, { key: 'workingDateTo', label: 'Working Date To', type: 'date' },
  { key: 'skuCode', label: 'SKU Code', type: 'text', placeholder: 'Enter SKU code' },
  ...commonFilters(o),
]

/** Server list state: the first page loads on every search / filter change, "Load more" appends the next. */
function useServerList<I, R>(load: (p: ListParams, s: AbortSignal) => Promise<{ data: I[]; meta: { total: number } }>, toRow: (i: I) => R) {
  const [q, setQ] = useState('')
  const [search, setSearch] = useState('')
  const [filters, setFilters] = useState<FilterValues>({})
  const [open, setOpen] = useState(false)
  const [rows, setRows] = useState<R[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [state, setState] = useState<{ loading: boolean; error?: string }>({ loading: true })
  const [reload, setReload] = useState(0)

  // A new search or filter starts again at page 1 (set together, so only one request goes out).
  useEffect(() => {
    const t = setTimeout(() => { if (q.trim() !== search) { setSearch(q.trim()); setPage(1) } }, SEARCH_DELAY_MS)
    return () => clearTimeout(t)
  }, [q, search])
  const applyFilters = (f: FilterValues) => { setFilters(f); setPage(1) }
  useEffect(() => {
    const ctrl = new AbortController()
    setState({ loading: true })
    load({ ...filters, q: search, page, pageSize: PO_OVERVIEW_PAGE_SIZE }, ctrl.signal)
      .then(({ data, meta }) => {
        setRows((prev) => (page === 1 ? data.map(toRow) : [...prev, ...data.map(toRow)]))
        setTotal(meta.total)
        setState({ loading: false })
      })
      .catch((e: unknown) => { if (!ctrl.signal.aborted) setState({ loading: false, error: e instanceof ApiError ? e.message : String(e) }) })
    return () => ctrl.abort()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, filters, page, reload])

  return {
    q, setQ, filters, setFilters: applyFilters, open, setOpen, rows, total, state, active: countActive(filters),
    more: rows.length < total, loadMore: () => setPage((p) => p + 1), retry: () => setReload((n) => n + 1),
  }
}

export default function POOverview() {
  const [tab, setTab] = useState<'shipment' | 'lines'>('shipment')
  const [options, setOptions] = useState<FilterOptions | null>(null)
  const [columns, setColumns] = useState<PoOverviewColumns | null>(null)
  const [totals, setTotals] = useState<{ shipment?: number; lines?: number }>({})
  const shipmentTotal = useCallback((n: number) => setTotals((t) => (t.shipment === n ? t : { ...t, shipment: n })), [])
  const linesTotal = useCallback((n: number) => setTotals((t) => (t.lines === n ? t : { ...t, lines: n })), [])
  useEffect(() => {
    const ctrl = new AbortController()
    getFilterOptions(ctrl.signal).then(setOptions).catch(() => undefined)
    getColumns(ctrl.signal).then(setColumns).catch(() => undefined)
    return () => ctrl.abort()
  }, [])
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
            {totals[k] !== undefined && <span className="tnum text-[11px] font-medium text-ink-400">{totals[k]}</span>}
          </button>
        ))}
      </div>
      {tab === 'shipment'
        ? <ShipmentTab options={options} columns={columns} onTotal={shipmentTotal} />
        : <LinesTab options={options} onTotal={linesTotal} />}
    </div>
  )
}

function ListStatus({ s, entity }: { s: { state: { loading: boolean; error?: string }; rows: unknown[]; total: number; more: boolean; loadMore: () => void; retry: () => void }; entity: string }) {
  if (s.state.error) {
    return (
      <div className="flex items-center gap-3 rounded-[var(--radius)] border border-crit/30 bg-crit-soft px-4 py-3 text-[13px] text-crit">
        <AlertTriangle className="size-4" /> Could not load {entity}: {s.state.error}
        <button onClick={s.retry} className="ml-auto font-semibold">Retry</button>
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between text-[12px] text-ink-600">
      <span>{s.state.loading ? `Loading ${entity}…` : `Showing ${s.rows.length} of ${s.total}`}</span>
      {s.more && !s.state.loading && <Button onClick={s.loadMore}>Load more</Button>}
    </div>
  )
}

const disabled = (label: string, icon: React.ReactNode) => <span title={NOT_AVAILABLE_YET}><Button disabled icon={icon}>{label}</Button></span>

type Row = Record<string, unknown>
type Col = [string, string, ColKind]
type Part = { label: string; cols: ColumnDef[]; edit: boolean }

const asCols = (cs: ColumnDef[]): Col[] => cs.map((c) => [c.label, c.field, c.kind])

/** The person's editable teams first, then the view-only ones; each set keeps the workflow order the API sends. */
const orderedTeams = (teams: TeamColumns[]) => [...teams.filter((t) => t.access === 'edit'), ...teams.filter((t) => t.access !== 'edit')]

/** The column groups a tab shows: Overview = all of them; a team tab = the key columns + that team's columns. */
const partsOf = (cfg: PoOverviewColumns, tab: string): Part[] => {
  const team = cfg.teams.find((t) => t.key === tab)
  const keyFields = new Set(cfg.keyColumns.map((c) => c.field))
  if (!team) {
    return [
      { label: COLUMN_GROUP_LABEL.KEY, cols: cfg.keyColumns, edit: false },
      { label: COLUMN_GROUP_LABEL.SHIPMENT, cols: cfg.systemColumns, edit: false },
      ...cfg.teams.map((t) => ({ label: `${t.step}. ${t.label}`, cols: t.columns.filter((c) => !keyFields.has(c.field)), edit: t.access === 'edit' })),
    ]
  }
  const own = new Set(team.columns.map((c) => c.field))
  return [
    { label: COLUMN_GROUP_LABEL.KEY, cols: cfg.keyColumns.filter((c) => !own.has(c.field)), edit: false },
    { label: `${team.step}. ${team.label}`, cols: team.columns, edit: team.access === 'edit' },
  ]
}

function TeamTabs({ teams, value, onChange }: { teams: TeamColumns[]; value: string; onChange: (k: string) => void }) {
  const tab = (key: string, label: string, step?: number, edit?: boolean) => {
    const on = value === key
    const look = edit
      ? on ? 'border-primary bg-primary text-white' : 'border-primary/40 bg-primary-soft text-primary hover:border-primary'
      : on ? 'border-ink-400 bg-alt text-ink-900' : 'border-line bg-surface text-ink-600 hover:text-ink-900'
    return (
      <button key={key} onClick={() => onChange(key)} className={`relative flex shrink-0 items-center gap-1.5 rounded-[var(--radius)] border px-3 py-1.5 text-[12.5px] font-semibold transition-colors ${look}`}>
        {step !== undefined && (
          <span className={`absolute -left-1.5 -top-1.5 grid size-4 place-items-center rounded-full text-[10px] font-bold ${edit ? (on ? 'bg-surface text-primary ring-1 ring-primary' : 'bg-primary text-white') : 'bg-ink-400 text-white'}`}>{step}</span>
        )}
        {label}
        {edit && <Pencil className="size-3" />}
      </button>
    )
  }
  return (
    <div className="flex gap-2.5 overflow-x-auto pb-1 pl-1.5 pt-2">
      {tab(OVERVIEW_TAB.KEY, OVERVIEW_TAB.LABEL)}
      {teams.map((t) => tab(t.key, t.label, t.step, t.access === 'edit'))}
    </div>
  )
}

function ShipmentTab({ options, columns, onTotal }: { options: FilterOptions | null; columns: PoOverviewColumns | null; onTotal: (n: number) => void }) {
  const s = useServerList(listShipments, (i: ShipmentItem): Row => i)
  const [sel, setSel] = useState<Row | null>(null)
  const [tab, setTab] = useState<string>(OVERVIEW_TAB.KEY)
  const defs = useMemo(() => shipFilters(options), [options])
  const teams = useMemo(() => (columns ? orderedTeams(columns.teams) : []), [columns])
  const parts = useMemo(() => (columns ? partsOf(columns, tab) : []), [columns, tab])
  const cols = useMemo(() => parts.flatMap((p) => asCols(p.cols)), [parts])
  const groups = useMemo(() => parts.filter((p) => p.cols.length).map((p) => ({ label: p.label, span: p.cols.length, edit: p.edit })), [parts])
  const editable = useMemo(() => new Set(parts.filter((p) => p.edit).flatMap((p) => p.cols.map((c) => c.field))), [parts])
  const drawerParts = useMemo(() => (columns ? partsOf(columns, OVERVIEW_TAB.KEY) : []), [columns])
  useEffect(() => { if (!s.state.loading && !s.state.error) onTotal(s.total) }, [s.total, s.state, onTotal])
  return (
    <div className="space-y-3">
      <SectionToolbar
        q={s.q} setQ={s.setQ} placeholder="Search by PO Number or UID…" filtersOpen={s.open} onToggleFilters={() => s.setOpen(!s.open)} activeFilters={s.active}
        entity="Shipment Status" onExport={(e) => exportRows(`shipment_status_${tab}`, e, cols, s.rows)}
        primary={disabled('Bulk Edit', <PencilLine className="size-4" />)}
      />
      {s.open && <FilterPanel defs={defs} value={s.filters} onApply={s.setFilters} onClose={() => s.setOpen(false)} />}
      {columns && <TeamTabs teams={teams} value={tab} onChange={setTab} />}
      <ListStatus s={s} entity="shipments" />
      <DataGrid
        cols={cols} rows={s.rows} rowKey={(r) => String(r.uid)} sticky={1} onRowClick={setSel} groups={groups} editable={editable}
        rowMenu={(r) => [{ label: 'View details', onClick: () => setSel(r) }]}
      />
      {sel && (
        <Drawer open onClose={() => setSel(null)} title={<span className="font-mono">{String(sel.poNumber ?? '')}</span>} sub={`UID ${String(sel.uid)} · ${String(sel.channel ?? '')} · ${String(sel.location ?? '')}`}
          footer={<><Button onClick={() => setSel(null)}>Close</Button>{disabled('Save changes', null)}</>}>
          {drawerParts.filter((p) => p.cols.length).map((p) => (
            <div key={p.label} className="mb-4">
              <div className={`mb-1 rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-wide ${p.edit ? 'bg-primary-soft text-primary' : 'bg-alt text-ink-600'}`}>{p.label}</div>
              <div className="divide-y divide-line">
                {asCols(p.cols).map(([l, k, kind]) => <Field key={k} label={l}><Cell kind={kind} v={sel[k]} /></Field>)}
              </div>
            </div>
          ))}
        </Drawer>
      )}
    </div>
  )
}

function LinesTab({ options, onTotal }: { options: FilterOptions | null; onTotal: (n: number) => void }) {
  const s = useServerList(listLines, lineRow)
  const [sel, setSel] = useState<LineRow | null>(null)
  const defs = useMemo(() => lineFilters(options), [options])
  useEffect(() => { if (!s.state.loading && !s.state.error) onTotal(s.total) }, [s.total, s.state, onTotal])
  return (
    <div className="space-y-3">
      <SectionToolbar
        q={s.q} setQ={s.setQ} placeholder="Search by PO Number or Shipment UID…" filtersOpen={s.open} onToggleFilters={() => s.setOpen(!s.open)} activeFilters={s.active}
        entity="PO Format Data" onExport={(e) => exportRows('po_format_data', e, PO_LINE_COLS, s.rows)}
        primary={disabled('Bulk SKU Update', <Upload className="size-4" />)}
      />
      {s.open && <FilterPanel defs={defs} value={s.filters} onApply={s.setFilters} onClose={() => s.setOpen(false)} />}
      <ListStatus s={s} entity="PO lines" />
      <DataGrid
        cols={PO_LINE_COLS} rows={s.rows} rowKey={(r) => `${r.shipmentUid}-${r.srNo}`} sticky={1} onRowClick={setSel}
        trailing={[{ label: 'Status', render: (r) => <Cell kind="status" v={r.status} /> }]}
        rowMenu={(r) => [{ label: 'View details', onClick: () => setSel(r) }]}
      />
      {sel && (
        <Drawer open onClose={() => setSel(null)} title={sel.skuName} sub={<><span className="font-mono">{sel.skuCode}</span> · PO <span className="font-mono">{sel.poNumber}</span> · line {sel.srNo}</>}
          footer={<><Button onClick={() => setSel(null)}>Close</Button>{disabled('Update quantity', null)}</>}>
          <div className="divide-y divide-line">
            {PO_LINE_COLS.map(([l, k, kind]) => <Field key={l} label={l}><Cell kind={kind} v={sel[k]} /></Field>)}
          </div>
        </Drawer>
      )}
    </div>
  )
}
