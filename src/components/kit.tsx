// Section-level toolkit: toolbar (search · filters · CSV/Excel/Upload), filter panel, data grid
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, Download, Filter, MoreHorizontal, Search, Upload, X } from 'lucide-react'
import { Badge, BulkUpload, downloadCsv } from './ui'
import { fmtDate, statusTone, type ColKind } from '../lib/ops'
import { NOT_IN_DB } from '../constants/masters'

// ---- Toolbar -----------------------------------------------------------
export function SectionToolbar({
  q, setQ, placeholder = 'Search…', filtersOpen, onToggleFilters, activeFilters = 0, entity, onExport, primary, extra,
}: {
  q: string; setQ: (v: string) => void; placeholder?: string
  filtersOpen?: boolean; onToggleFilters?: () => void; activeFilters?: number
  entity: string; onExport: (ext: 'csv' | 'xls') => void; primary?: ReactNode; extra?: ReactNode
}) {
  const [upload, setUpload] = useState(false)
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="relative flex min-w-[220px] flex-1 items-center sm:max-w-sm">
        <Search className="pointer-events-none absolute left-3 size-4 text-ink-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="h-9 w-full rounded-[var(--radius)] border border-line bg-surface pl-9 pr-3 text-[13px] outline-none transition-shadow placeholder:text-ink-400 focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </label>
      {onToggleFilters && (
        <button
          onClick={onToggleFilters}
          className={`inline-flex h-9 items-center gap-1.5 rounded-[var(--radius)] border px-3 text-[13px] font-medium transition-colors ${
            filtersOpen || activeFilters ? 'border-primary/40 bg-primary-soft text-primary' : 'border-line bg-surface text-ink-900 hover:bg-canvas'
          }`}
        >
          <Filter className="size-4" /> Filters
          {activeFilters > 0 && <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">{activeFilters}</span>}
        </button>
      )}
      {extra}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button onClick={() => onExport('csv')} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius)] bg-primary-soft px-3 text-[13px] font-medium text-primary hover:bg-primary/15">
          <Download className="size-4" /> CSV
        </button>
        <button onClick={() => onExport('xls')} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius)] bg-primary-soft px-3 text-[13px] font-medium text-primary hover:bg-primary/15">
          <Download className="size-4" /> Excel
        </button>
        <button onClick={() => setUpload(true)} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius)] border border-line bg-surface px-3 text-[13px] font-medium text-ink-900 hover:bg-canvas">
          <Upload className="size-4" /> Upload CSV
        </button>
        {primary}
      </div>
      <BulkUpload open={upload} onClose={() => setUpload(false)} entity={entity} onDownloadTemplate={() => onExport('csv')} />
    </div>
  )
}

export function PrimaryBtn({ children, onClick, icon }: { children: ReactNode; onClick?: () => void; icon?: ReactNode }) {
  return (
    <button onClick={onClick} className="inline-flex h-9 items-center gap-1.5 rounded-[var(--radius)] bg-primary px-3.5 text-[13px] font-semibold text-white shadow-sm hover:opacity-90">
      {icon}{children}
    </button>
  )
}

// ---- Filters ------------------------------------------------------------
export type FilterDef =
  | { key: string; label: string; type: 'date' }
  | { key: string; label: string; type: 'multi'; options: readonly string[]; placeholder?: string }
  | { key: string; label: string; type: 'text'; placeholder?: string }
export type FilterValues = Record<string, string | string[]>

export const countActive = (v: FilterValues) => Object.values(v).filter((x) => (Array.isArray(x) ? x.length : x)).length

function MultiSelect({ value, onChange, options, placeholder }: { value: string[]; onChange: (v: string[]) => void; options: readonly string[]; placeholder: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const h = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`flex h-9 w-full items-center gap-2 rounded-[var(--radius)] border bg-surface px-3 text-left text-[13px] ${open ? 'border-primary ring-2 ring-primary/15' : 'border-line'}`}
      >
        <span className={`min-w-0 flex-1 truncate ${value.length ? 'text-ink-900' : 'text-ink-400'}`}>
          {value.length ? (value.length <= 2 ? value.join(', ') : `${value[0]} +${value.length - 1}`) : placeholder}
        </span>
        {value.length > 0 ? (
          <X className="size-3.5 shrink-0 text-ink-400 hover:text-ink-900" onClick={(e) => { e.stopPropagation(); onChange([]) }} />
        ) : (
          <ChevronDown className="size-3.5 shrink-0 text-ink-400" />
        )}
      </button>
      {open && (
        <div className="absolute z-30 mt-1 max-h-60 w-full min-w-[180px] overflow-y-auto rounded-[var(--radius)] border border-line bg-surface p-1 shadow-lg">
          {options.map((o) => {
            const on = value.includes(o)
            return (
              <label key={o} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-[13px] hover:bg-alt">
                <input type="checkbox" checked={on} onChange={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])} className="accent-[var(--color-primary)]" />
                {o}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}

const fieldCls = 'h-9 w-full rounded-[var(--radius)] border border-line bg-surface px-3 text-[13px] outline-none placeholder:text-ink-400 focus:border-primary focus:ring-2 focus:ring-primary/15'

export function FilterPanel({ defs, value, onApply, onClose }: { defs: FilterDef[]; value: FilterValues; onApply: (v: FilterValues) => void; onClose: () => void }) {
  const [draft, setDraft] = useState<FilterValues>(value)
  const set = (k: string, v: string | string[]) => setDraft((d) => ({ ...d, [k]: v }))
  return (
    <div className="rounded-[var(--radius-card)] border border-primary/25 bg-surface p-4 shadow-[0_1px_0_rgba(79,70,229,0.06)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[13px] font-semibold text-ink-900">Filters</div>
        <button onClick={onClose} className="rounded p-1 text-ink-400 hover:bg-alt hover:text-ink-900"><X className="size-4" /></button>
      </div>
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
        {defs.map((d) => (
          <div key={d.key}>
            <div className="mb-1 text-[12px] font-medium text-ink-600">{d.label}</div>
            {d.type === 'multi' ? (
              <MultiSelect value={(draft[d.key] as string[]) ?? []} onChange={(v) => set(d.key, v)} options={d.options} placeholder={d.placeholder ?? `Select ${d.label.toLowerCase()}`} />
            ) : d.type === 'date' ? (
              <div className="relative">
                <Calendar className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-ink-400" />
                <input type="date" value={(draft[d.key] as string) ?? ''} onChange={(e) => set(d.key, e.target.value)} className={`${fieldCls} pl-8 ${draft[d.key] ? '' : 'text-ink-400'}`} />
              </div>
            ) : (
              <input value={(draft[d.key] as string) ?? ''} onChange={(e) => set(d.key, e.target.value)} placeholder={d.placeholder} className={fieldCls} />
            )}
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button onClick={() => { setDraft({}); onApply({}) }} className="h-8 rounded-[var(--radius)] border border-line px-3 text-[13px] font-medium hover:bg-canvas">Clear</button>
        <button onClick={() => onApply(draft)} className="h-8 rounded-[var(--radius)] bg-primary px-3.5 text-[13px] font-semibold text-white hover:opacity-90">Apply</button>
      </div>
    </div>
  )
}

// Generic matcher — keys ending in From/To compare against the base date key
export function applyFilters<T>(rows: T[], f: FilterValues): T[] {
  return rows.filter((r) => {
    const rec = r as Record<string, unknown>
    for (const [k, v] of Object.entries(f)) {
      if (Array.isArray(v) ? !v.length : !v) continue
      if (k.endsWith('From') || k.endsWith('To')) {
        const base = k.replace(/(From|To)$/, '')
        const val = String(rec[base] ?? '')
        if (!val) return false
        if (k.endsWith('From') && val < (v as string)) return false
        if (k.endsWith('To') && val > (v as string)) return false
      } else if (k === 'notAssigned') {
        if ((v as string[]).some((field) => rec[field])) return false
      } else if (Array.isArray(v)) {
        if (!v.includes(String(rec[k]))) return false
      } else if (!String(rec[k] ?? '').toLowerCase().includes(v.toLowerCase())) return false
    }
    return true
  })
}

export function useSection<T>(rows: T[], searchKeys: (keyof T)[]) {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [filters, setFilters] = useState<FilterValues>({})
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase()
    const base = s ? rows.filter((r) => searchKeys.some((k) => String(r[k] ?? '').toLowerCase().includes(s))) : rows
    return applyFilters(base, filters)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, q, filters])
  return { q, setQ, open, setOpen, filters, setFilters, filtered, active: countActive(filters) }
}

export function exportRows<T>(name: string, ext: 'csv' | 'xls', cols: [string, keyof T, ColKind][], rows: T[]) {
  downloadCsv(`${name}.${ext === 'xls' ? 'xls' : 'csv'}`, cols.map((c) => c[0]), rows.map((r) => cols.map((c) => String(r[c[1]] ?? ''))))
}

// ---- Data grid ---------------------------------------------------------
export function Cell({ kind, v }: { kind: ColKind; v: unknown }) {
  if (v === '' || v === null || v === undefined) return <span className="text-ink-400">—</span>
  if (v === NOT_IN_DB) return <span className="whitespace-nowrap text-[12px] text-ink-400">{NOT_IN_DB}</span>
  switch (kind) {
    case 'mono': return <span className="font-mono text-[12.5px]">{String(v)}</span>
    case 'date': return <span className="tnum text-[12.5px]">{fmtDate(String(v))}</span>
    case 'num': return <span className="tnum">{Number(v).toLocaleString('en-IN')}</span>
    case 'money': return <span className="tnum">₹{Number(v).toLocaleString('en-IN')}</span>
    case 'link': return <a href="#" onClick={(e) => e.preventDefault()} className="text-primary hover:underline">{String(v)}</a>
    case 'status': return <Badge tone={statusTone(String(v))}>{String(v)}</Badge>
    default: return <span className="block max-w-[240px] truncate">{String(v)}</span>
  }
}

export function DataGrid<T>({
  cols, rows, rowKey, sticky = 1, onRowClick, rowMenu, pageSize = 15, trailing, rowClass, groups, editable,
}: {
  cols: [string, keyof T, ColKind][]; rows: T[]; rowKey: (r: T) => string; sticky?: number
  onRowClick?: (r: T) => void; rowMenu?: (r: T) => { label: string; onClick: () => void }[]; pageSize?: number
  trailing?: { label: string; render: (r: T) => ReactNode }[]; rowClass?: (r: T) => string
  /** A header row above the columns: each group spans `span` columns in order; `edit` = tinted as editable. */
  groups?: { label: string; span: number; edit?: boolean }[]
  /** Columns the person can edit: header and cells tinted with the primary colour. */
  editable?: ReadonlySet<keyof T>
}) {
  const [page, setPage] = useState(0)
  const [menu, setMenu] = useState<string | null>(null)
  const pages = Math.max(1, Math.ceil(rows.length / pageSize))
  useEffect(() => setPage(0), [rows.length])
  const view = rows.slice(page * pageSize, page * pageSize + pageSize)
  const stickyW = 132
  return (
    <div className="overflow-hidden rounded-[var(--radius-card)] border border-line bg-surface">
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-0 text-[13px]">
          <thead>
            {groups && (
              <tr>
                {groups.map((g, i) => (
                  <th key={`${g.label}-${i}`} colSpan={g.span}
                    className={`whitespace-nowrap border-b border-l border-line px-3 py-1.5 text-left text-[11px] font-semibold uppercase tracking-wide first:border-l-0 ${g.edit ? 'bg-primary-soft text-primary' : 'bg-alt text-ink-600'}`}>
                    {g.label}
                  </th>
                ))}
                {(trailing?.length ?? 0) + (rowMenu ? 1 : 0) > 0 && <th colSpan={(trailing?.length ?? 0) + (rowMenu ? 1 : 0)} className="border-b border-l border-line bg-alt" />}
              </tr>
            )}
            <tr>
              {cols.map(([label, key], i) => (
                <th
                  key={label}
                  style={i < sticky ? { left: i * stickyW, minWidth: stickyW } : undefined}
                  className={`sticky top-0 whitespace-nowrap border-b border-line px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide ${editable?.has(key) ? 'bg-primary-soft text-primary' : 'bg-alt text-ink-600'} ${i < sticky ? 'z-20' : 'z-10'} ${i === sticky - 1 ? 'border-r' : ''}`}
                >
                  {label}
                </th>
              ))}
              {trailing?.map((t) => <th key={t.label} className="border-b border-line bg-alt px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-600">{t.label}</th>)}
              {rowMenu && <th className="sticky right-0 z-20 border-b border-l border-line bg-alt px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-600">Action</th>}
            </tr>
          </thead>
          <tbody>
            {view.length === 0 && (
              <tr><td colSpan={cols.length + 2} className="px-4 py-14 text-center text-[13px] text-ink-400">No records match the current search & filters.</td></tr>
            )}
            {view.map((r) => {
              const k = rowKey(r)
              return (
                <tr key={k} onClick={() => onRowClick?.(r)} className={`group ${onRowClick ? 'cursor-pointer' : ''} ${rowClass?.(r) ?? ''}`}>
                  {cols.map(([label, key, kind], i) => (
                    <td
                      key={label}
                      style={i < sticky ? { left: i * stickyW, minWidth: stickyW } : undefined}
                      className={`whitespace-nowrap border-b border-line px-3 py-2.5 group-hover:bg-canvas ${i < sticky ? 'sticky z-[5] bg-surface' : editable?.has(key) ? 'bg-primary-soft/40' : ''} ${i === sticky - 1 ? 'border-r' : ''}`}
                    >
                      <Cell kind={kind} v={r[key]} />
                    </td>
                  ))}
                  {trailing?.map((t) => <td key={t.label} className="whitespace-nowrap border-b border-line px-3 py-2.5 group-hover:bg-canvas">{t.render(r)}</td>)}
                  {rowMenu && (
                    <td className="sticky right-0 z-[5] border-b border-l border-line bg-surface px-2 py-1.5 group-hover:bg-canvas" onClick={(e) => e.stopPropagation()}>
                      <div className="relative">
                        <button aria-label="Open menu" onClick={() => setMenu(menu === k ? null : k)} className="rounded-md p-1.5 text-ink-600 hover:bg-alt hover:text-ink-900">
                          <MoreHorizontal className="size-4" />
                        </button>
                        {menu === k && (
                          <div className="absolute right-0 z-30 mt-1 w-40 rounded-[var(--radius)] border border-line bg-surface p-1 shadow-lg" onMouseLeave={() => setMenu(null)}>
                            {rowMenu(r).map((m) => (
                              <button key={m.label} onClick={() => { setMenu(null); m.onClick() }} className="block w-full rounded px-2.5 py-1.5 text-left text-[13px] hover:bg-alt">{m.label}</button>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t border-line px-4 py-2.5 text-[12px] text-ink-600">
        <span>
          <span className="tnum">{rows.length ? page * pageSize + 1 : 0}–{Math.min(rows.length, (page + 1) * pageSize)}</span> of <span className="tnum">{rows.length}</span> records
        </span>
        <div className="flex items-center gap-1">
          <button disabled={page === 0} onClick={() => setPage(page - 1)} className="rounded-md p-1.5 hover:bg-alt disabled:opacity-30"><ChevronLeft className="size-4" /></button>
          {Array.from({ length: pages }, (_, i) => i).filter((i) => i < 2 || i === pages - 1 || Math.abs(i - page) <= 1).map((i, idx, arr) => (
            <span key={i} className="flex items-center">
              {idx > 0 && arr[idx - 1] !== i - 1 && <span className="px-1 text-ink-400">…</span>}
              <button onClick={() => setPage(i)} className={`tnum size-7 rounded-md text-[12px] font-medium ${page === i ? 'border border-line bg-surface text-ink-900 shadow-sm' : 'hover:bg-alt'}`}>{i + 1}</button>
            </span>
          ))}
          <button disabled={page >= pages - 1} onClick={() => setPage(page + 1)} className="flex items-center gap-0.5 rounded-md px-2 py-1 font-medium hover:bg-alt disabled:opacity-30">Next <ChevronRight className="size-4" /></button>
        </div>
      </div>
    </div>
  )
}

// Field row used in drawers
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[150px_1fr] items-start gap-3 py-1.5 text-[13px]">
      <div className="text-ink-600">{label}</div>
      <div className="min-w-0 text-ink-900">{children}</div>
    </div>
  )
}
export const inputCls = fieldCls
