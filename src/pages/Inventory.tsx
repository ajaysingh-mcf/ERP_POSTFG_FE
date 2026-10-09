import { useMemo, useState } from 'react'
import {
  agingBand, computeInventory, INTRANSIT_STATES, overallInventory, PIVOT_FACILITIES,
} from '../lib/data'
import type { InventoryRowComputed, OverallSku } from '../lib/data'
import { Badge, Button, Card, downloadCsv, Drawer, PageTitle, PillToggle, Td, Th, Toolbar } from '../components/ui'

const num = (n: number) => n.toLocaleString('en-IN')

function AgingCell({ days }: { days: number }) {
  const { band, tone } = agingBand(days)
  return <span title={band}><Badge tone={tone}>{days}d</Badge></span>
}
function Delta({ d, signal }: { d: number; signal: boolean }) {
  if (!signal) return <span className="tnum text-[12px] text-ink-400">{d > 0 ? '+' : ''}{d}%</span>
  return <Badge tone={d > 0 ? 'ok' : 'crit'}>{d > 0 ? '▲' : '▼'} {Math.abs(d)}%</Badge>
}

export default function Inventory({ embedded = false }: { embedded?: boolean }) {
  const [view] = useState<'channel' | 'overall' | 'pivot'>('channel')
  const [snapshot, setSnapshot] = useState<'live' | 'monday'>('live')
  const [signalsOnly, setSignalsOnly] = useState(false)
  const [q, setQ] = useState('')
  const [drawerSku, setDrawerSku] = useState<InventoryRowComputed | OverallSku | null>(null)

  const channelRows = useMemo(() => computeInventory(), [])
  const overallRows = useMemo(() => overallInventory(), [])

  const filterFn = (name: string, sku: string, signal: boolean) =>
    (name.toLowerCase().includes(q.toLowerCase()) || sku.toLowerCase().includes(q.toLowerCase())) && (!signalsOnly || signal)

  const channel = channelRows.filter((r) => filterFn(r.name, r.sku, r.signal))
  const overall = overallRows.filter((r) => filterFn(r.name, r.sku, r.signal))

  return (
    <div className="space-y-5">
      {!embedded && (
      <PageTitle
        title="Inventory"
        sub="Live inventory for Demand Planning · Available = SOH + in-transit · DRR, days-of-cover and Δ WoW ride alongside · V1 covers B2C + D2C"
        right={
          <div className="flex items-center gap-2">
            <div className="flex rounded-md border border-line bg-surface p-0.5 text-xs">
              {(['live', 'monday'] as const).map((s) => (
                <button key={s} onClick={() => setSnapshot(s)} className={`rounded px-2.5 py-1 font-medium transition-colors ${snapshot === s ? 'bg-primary text-white' : 'text-ink-600 hover:text-ink-900'}`}>
                  {s === 'monday' ? 'Mon / month-end' : 'Real-time'}
                </button>
              ))}
            </div>
          </div>
        }
      />
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        {view !== 'pivot' && (
          <label className="flex items-center gap-2 text-[12px] text-ink-600">
            <input type="checkbox" checked={signalsOnly} onChange={(e) => setSignalsOnly(e.target.checked)} /> Signals only
          </label>
        )}
      </div>

      {view === 'pivot' ? (
        <Pivot rows={overallRows} />
      ) : (
        <Card>
          <div className="flex items-center justify-between border-b border-line px-3 py-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter by SKU or name…" className="w-64 rounded-md border border-line bg-canvas px-2.5 py-1.5 text-xs outline-none focus:border-primary" />
            {snapshot === 'monday' && <Badge tone="info">Frozen snapshot · Mon 09:00</Badge>}
          </div>
          <Toolbar
            onExport={() => view === 'channel'
              ? downloadCsv('inventory_channel.csv', ['SKU Code', 'SKU Name', 'Channel', 'Location', 'SOH', 'In-transit', 'Available', 'DRR', 'Days of cover', 'Δ WoW'], channel.map((r) => [r.sku, r.name, r.channel, r.location, r.soh, r.inTransit, r.combined, r.drr, r.aging, `${r.drrDelta}%`]))
              : downloadCsv('inventory_overall.csv', ['SKU Code', 'SKU Name', 'Total SOH', 'Total In-transit', 'Available', 'DRR', 'Aging', 'Δ WoW'], overall.map((r) => [r.sku, r.name, r.soh, r.inTransit, r.available, r.drr, r.aging, `${r.drrDelta}%`]))}
          />
          <div className="overflow-x-auto">
            {view === 'channel' ? (
              <table className="w-full border-collapse">
                <thead className="border-b border-line bg-alt/60">
                  <tr><Th>SKU Code</Th><Th>SKU Name</Th><Th>Channel</Th><Th>Location</Th><Th right>SOH</Th><Th right>In-transit</Th><Th right>Available</Th><Th right>DRR</Th><Th right>Days of cover</Th><Th right>Δ WoW</Th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {channel.map((r, i) => (
                    <tr key={i} className="cursor-pointer hover:bg-alt/40" onClick={() => setDrawerSku(r)}>
                      <Td mono className="text-[12px] font-medium text-primary">{r.sku}</Td>
                      <Td><span className="text-[13px]">{r.name}</span></Td>
                      <Td>{r.channel} <span className="text-[10px] text-ink-400">{r.type}</span></Td>
                      <Td><span className="text-[12px] text-ink-600">{r.location}</span></Td>
                      <Td right mono>{num(r.soh)}</Td>
                      <Td right mono className="text-info">{r.inTransit ? num(r.inTransit) : '—'}</Td>
                      <Td right mono className="font-semibold">{num(r.combined)}</Td>
                      <Td right mono>{r.drr}</Td>
                      <Td right><AgingCell days={r.aging} /></Td>
                      <Td right><Delta d={r.drrDelta} signal={r.signal} /></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full border-collapse">
                <thead className="border-b border-line bg-alt/60">
                  <tr><Th>SKU Code</Th><Th>SKU Name</Th><Th right>Total SOH</Th><Th right>Total In-transit</Th><Th right>Available</Th><Th right>DRR</Th><Th right>Aging</Th><Th right>Δ WoW</Th></tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {overall.map((r) => (
                    <tr key={r.sku} className="cursor-pointer hover:bg-alt/40" onClick={() => setDrawerSku(r)}>
                      <Td mono className="text-[12px] font-medium text-primary">{r.sku}</Td>
                      <Td><span className="text-[13px]">{r.name}</span></Td>
                      <Td right mono>{num(r.soh)}</Td>
                      <Td right mono className="text-info">{num(r.inTransit)}</Td>
                      <Td right mono className="font-semibold">{num(r.available)}</Td>
                      <Td right mono>{r.drr}</Td>
                      <Td right><AgingCell days={r.aging} /></Td>
                      <Td right><Delta d={r.drrDelta} signal={r.signal} /></Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      )}

      {drawerSku && <InvDrawer row={drawerSku} onClose={() => setDrawerSku(null)} />}
    </div>
  )
}

function Pivot({ rows }: { rows: OverallSku[] }) {
  const [metric, setMetric] = useState<'soh' | 'inTransit' | 'available'>('available')
  // deterministic spread across facilities for the prototype
  const cell = (r: OverallSku, fi: number) => {
    const base = metric === 'soh' ? r.soh : metric === 'inTransit' ? r.inTransit : r.available
    const weights = [0.42, 0.3, 0.15, 0.1, 0.03]
    return Math.round(base * weights[fi])
  }
  const max = Math.max(...rows.flatMap((r) => PIVOT_FACILITIES.map((_, i) => cell(r, i))))
  const shade = (v: number) => {
    const t = max ? v / max : 0
    return { background: `color-mix(in srgb, var(--color-primary) ${Math.round(t * 22)}%, white)` }
  }
  return (
    <Card>
      <div className="flex items-center justify-between border-b border-line px-3 py-2">
        <span className="text-[13px] font-semibold">SKU × Facility · units</span>
        <PillToggle value={metric} onChange={setMetric} options={[{ key: 'available', label: 'Available' }, { key: 'soh', label: 'SOH' }, { key: 'inTransit', label: 'In-transit' }]} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead className="border-b border-line bg-alt/60">
            <tr><Th>SKU</Th>{PIVOT_FACILITIES.map((f) => <Th key={f} right>{f}</Th>)}<Th right>Total</Th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.sku} className="hover:bg-alt/40">
                <Td mono className="text-[12px] font-medium text-primary">{r.sku}</Td>
                {PIVOT_FACILITIES.map((f, i) => (
                  <td key={f} className="tnum px-3 py-2.5 text-right text-[13px]" style={shade(cell(r, i))}>{num(cell(r, i))}</td>
                ))}
                <Td right mono className="font-semibold">{num(PIVOT_FACILITIES.reduce((s, _, i) => s + cell(r, i), 0))}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function InvDrawer({ row, onClose }: { row: InventoryRowComputed | OverallSku; onClose: () => void }) {
  const inTransit = 'inTransit' in row ? row.inTransit : 0
  const soh = row.soh
  const feeds = [
    ['Channel SOH feed', Math.round(soh * 0.6)],
    ['Snapshot — MWH', Math.round(soh * 0.28)],
    ['Snapshot — DarkStore', Math.round(soh * 0.12)],
  ] as const
  const states = INTRANSIT_STATES.map((s, i) => [s, Math.round(inTransit * [0.4, 0.1, 0.2, 0.25, 0.05][i])] as const)
  return (
    <Drawer open onClose={onClose} title={<span className="font-mono">{row.sku}</span>} sub={row.name}
      footer={<Button variant="primary" onClick={onClose}>Flag for replenishment</Button>}>
      <div className="grid grid-cols-3 gap-3">
        {[['SOH', soh], ['In-transit', inTransit], ['Available', soh + inTransit]].map(([k, v]) => (
          <div key={k as string} className="rounded-lg border border-line bg-canvas p-3">
            <div className="text-[10px] uppercase tracking-wide text-ink-400">{k}</div>
            <div className="tnum mt-1 text-lg font-semibold">{num(v as number)}</div>
          </div>
        ))}
      </div>

      <div className="mt-5 text-[12px] font-semibold text-ink-900">SOH by feed</div>
      <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
        {feeds.map(([k, v]) => <li key={k} className="flex items-center justify-between px-3 py-2 text-[12px]"><span className="text-ink-600">{k}</span><span className="tnum font-medium">{num(v)}</span></li>)}
      </ul>

      <div className="mt-5 text-[12px] font-semibold text-ink-900">In-transit by state</div>
      <ul className="mt-2 divide-y divide-line rounded-lg border border-line">
        {states.map(([k, v]) => (
          <li key={k} className="flex items-center justify-between px-3 py-2 text-[12px]">
            <span className="text-ink-600">{k}{k === 'Working Hold' && <span className="ml-1 text-[10px] text-warn">DP-only</span>}</span>
            <span className="tnum font-medium">{num(v)}</span>
          </li>
        ))}
      </ul>
    </Drawer>
  )
}
