import { useMemo, useState } from 'react'
import { Badge, PageTitle, SubTabs } from '../../components/ui'
import { DataGrid, FilterPanel, SectionToolbar, exportRows, useSection, type FilterDef } from '../../components/kit'
import Inventory from '../Inventory'
import { agingBand, computeInventory, overallInventory, CHANNELS, PIVOT_FACILITIES, type InventoryRowComputed, type OverallSku } from '../../lib/data'
import { channelInventory, type ColKind } from '../../lib/ops'

type View = 'overview' | 'channel' | 'sku' | 'skuFacility' | 'type'
const Aging = ({ d }: { d: number }) => { const b = agingBand(d); return <Badge tone={b.tone}>{d}d · {b.band}</Badge> }

export default function InventoryCalc() {
  const [view, setView] = useState<View>('overview')
  return (
    <div className="space-y-5">
      <PageTitle title="Inventory Calculation" sub="Available = SOH + in-transit · aging = available ÷ DRR · switch lenses without leaving the module" />
      <SubTabs value={view} onChange={setView} tabs={[
        { key: 'overview', label: 'Overview' }, { key: 'channel', label: 'Channel-wise' }, { key: 'sku', label: 'SKU-wise' },
        { key: 'skuFacility', label: 'SKU × Facility' }, { key: 'type', label: 'B2C vs D2C' },
      ]} />
      {view === 'overview' && <Inventory embedded />}
      {view === 'channel' && <ChannelView />}
      {view === 'sku' && <SkuView />}
      {view === 'skuFacility' && <SkuFacility />}
      {view === 'type' && <TypeView />}
    </div>
  )
}

type ChRow = ReturnType<typeof channelInventory>[number]
function ChannelView() {
  const rows = useMemo(() => channelInventory(), [])
  const s = useSection<ChRow>(rows, ['channel'])
  const cols: [string, keyof ChRow, ColKind][] = [['Channel', 'channel', 'text'], ['SKUs', 'skus', 'num'], ['SOH', 'soh', 'num'], ['In-transit', 'inTransit', 'num'], ['DRR', 'drr', 'num']]
  return (
    <div className="space-y-3">
      <SectionToolbar q={s.q} setQ={s.setQ} placeholder="Search channel…" filtersOpen={s.open} onToggleFilters={() => s.setOpen(!s.open)} activeFilters={s.active} entity="Channel inventory" onExport={(e) => exportRows('inventory_channel', e, cols, s.filtered)} />
      {s.open && <FilterPanel defs={[{ key: 'channel', label: 'Channel', type: 'multi', options: CHANNELS }]} value={s.filters} onApply={s.setFilters} onClose={() => s.setOpen(false)} />}
      <DataGrid cols={cols} rows={s.filtered} rowKey={(r) => r.channel} trailing={[{ label: 'Aging', render: (r) => <Aging d={r.aging} /> }]} />
    </div>
  )
}

function SkuView() {
  const rows = useMemo(() => overallInventory(), [])
  const s = useSection<OverallSku>(rows, ['sku', 'name'])
  const cols: [string, keyof OverallSku, ColKind][] = [['SKU', 'sku', 'mono'], ['Name', 'name', 'text'], ['SOH', 'soh', 'num'], ['In-transit', 'inTransit', 'num'], ['Available', 'available', 'num'], ['DRR', 'drr', 'num'], ['Δ WoW %', 'drrDelta', 'num']]
  const defs: FilterDef[] = [{ key: 'sku', label: 'SKU Code', type: 'text', placeholder: 'Enter SKU code' }]
  return (
    <div className="space-y-3">
      <SectionToolbar q={s.q} setQ={s.setQ} placeholder="Search SKU code or name…" filtersOpen={s.open} onToggleFilters={() => s.setOpen(!s.open)} activeFilters={s.active} entity="SKU inventory" onExport={(e) => exportRows('inventory_sku', e, cols, s.filtered)} />
      {s.open && <FilterPanel defs={defs} value={s.filters} onApply={s.setFilters} onClose={() => s.setOpen(false)} />}
      <DataGrid cols={cols} rows={s.filtered} rowKey={(r) => r.sku} trailing={[{ label: 'Aging', render: (r) => <Aging d={r.aging} /> }]} />
    </div>
  )
}

function SkuFacility() {
  const raw = useMemo(() => computeInventory(), [])
  const skus = useMemo(() => [...new Map(raw.map((r) => [r.sku, r.name])).entries()], [raw])
  const [q, setQ] = useState('')
  const cell = (sku: string, f: string) => raw.filter((r) => r.sku === sku && r.location === f).reduce((a, r) => a + r.combined, 0)
  const view = skus.filter(([k, n]) => (k + n).toLowerCase().includes(q.toLowerCase()))
  const max = Math.max(...skus.flatMap(([k]) => PIVOT_FACILITIES.map((f) => cell(k, f))))
  return (
    <div className="space-y-3">
      <SectionToolbar q={q} setQ={setQ} placeholder="Search SKU…" entity="SKU × Facility" onExport={() => {}} />
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-surface">
        <table className="w-full text-[13px]">
          <thead><tr className="bg-alt">
            <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-ink-600">SKU</th>
            {PIVOT_FACILITIES.map((f) => <th key={f} className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-600">{f}</th>)}
            <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wide text-ink-600">Total</th>
          </tr></thead>
          <tbody>
            {view.map(([k, n]) => {
              const vals = PIVOT_FACILITIES.map((f) => cell(k, f))
              return (
                <tr key={k} className="border-t border-line">
                  <td className="px-3 py-2.5"><div className="font-mono text-[12.5px]">{k}</div><div className="text-[12px] text-ink-400">{n}</div></td>
                  {vals.map((v, i) => (
                    <td key={i} className="px-3 py-2.5 text-right">
                      {v ? <span className="tnum inline-block min-w-16 rounded px-2 py-1" style={{ background: `rgba(79,70,229,${0.06 + (v / max) * 0.4})` }}>{v.toLocaleString('en-IN')}</span> : <span className="text-ink-400">—</span>}
                    </td>
                  ))}
                  <td className="tnum px-3 py-2.5 text-right font-semibold">{vals.reduce((a, b) => a + b, 0).toLocaleString('en-IN')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TypeView() {
  const rows = useMemo(() => computeInventory(), [])
  const s = useSection<InventoryRowComputed>(rows, ['sku', 'name', 'channel'])
  const cols: [string, keyof InventoryRowComputed, ColKind][] = [['Type', 'type', 'status'], ['SKU', 'sku', 'mono'], ['Name', 'name', 'text'], ['Channel', 'channel', 'text'], ['Location', 'location', 'text'], ['SOH', 'soh', 'num'], ['In-transit', 'inTransit', 'num'], ['DRR', 'drr', 'num']]
  return (
    <div className="space-y-3">
      <SectionToolbar q={s.q} setQ={s.setQ} placeholder="Search SKU, channel…" filtersOpen={s.open} onToggleFilters={() => s.setOpen(!s.open)} activeFilters={s.active} entity="Inventory by type" onExport={(e) => exportRows('inventory_type', e, cols, s.filtered)} />
      {s.open && <FilterPanel defs={[{ key: 'type', label: 'Type', type: 'multi', options: ['B2C', 'D2C'] }, { key: 'channel', label: 'Channel', type: 'multi', options: CHANNELS }]} value={s.filters} onApply={s.setFilters} onClose={() => s.setOpen(false)} />}
      <DataGrid cols={cols} rows={s.filtered} rowKey={(r) => r.sku + r.channel} trailing={[{ label: 'Aging', render: (r) => <Aging d={r.aging} /> }]} />
    </div>
  )
}
