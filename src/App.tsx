import { useState } from 'react'
import type { ComponentType } from 'react'
import { BadgeCheck, ChevronDown, ChevronsLeft, ChevronsRight, Database, LineChart, Search, Truck } from 'lucide-react'
import Analytics from './pages/Analytics'
import Masters from './pages/Masters'
import Approvals from './pages/Approvals'
import POOverview from './pages/ops/POOverview'
import POProcessing from './pages/ops/POProcessing'
import POWorking from './pages/ops/POWorking'
import ShortSkus from './pages/ops/ShortSkus'
import InventoryCalc from './pages/dp/InventoryCalc'
import DrrAging from './pages/dp/DrrAging'
import DPAnalytics from './pages/dp/DPAnalytics'
import { MASTER_TABS } from './lib/data'
import { APPROVALS, CHANNEL_PRIORITY_DEFAULT } from './lib/ops'

type Module = 'masters' | 'ops' | 'dp' | 'approvals'
type Route = { module: Module; section: string }

const GROUPS: { key: Module; label: string; icon: ComponentType<{ className?: string }>; items: string[] }[] = [
  { key: 'masters', label: 'Masters', icon: Database, items: MASTER_TABS },
  { key: 'ops', label: 'B2B/B2C Operations', icon: Truck, items: ['PO Overview', 'PO Processing & Review', 'PO Working', 'SKUs Short', 'Analytics'] },
  { key: 'dp', label: 'Demand Planning', icon: LineChart, items: ['Inventory Calculation', 'DRR & Aging', 'Analytics'] },
  { key: 'approvals', label: 'Approvals', icon: BadgeCheck, items: [] },
]

const BRANDS = ['All', 'mCaffeine', 'Hyphen'] as const
const pending = APPROVALS.filter((a) => a.status === 'Pending').length

export default function App() {
  const [route, setRoute] = useState<Route>({ module: 'ops', section: 'PO Overview' })
  const [open, setOpen] = useState<Record<Module, boolean>>({ masters: false, ops: true, dp: true, approvals: false })
  const [collapsed, setCollapsed] = useState(false)
  const [prio, setPrio] = useState<Record<string, number>>(CHANNEL_PRIORITY_DEFAULT)
  const [brand, setBrand] = useState<(typeof BRANDS)[number]>('All')
  const go = (module: Module, section = '') => setRoute({ module, section })

  const page = (() => {
    const { module, section } = route
    if (module === 'masters') return <Masters tab={section || MASTER_TABS[0]} />
    if (module === 'approvals') return <Approvals />
    if (module === 'ops') {
      if (section === 'PO Processing & Review') return <POProcessing />
      if (section === 'PO Working') return <POWorking prio={prio} setPrio={setPrio} />
      if (section === 'SKUs Short') return <ShortSkus priority={prio} />
      if (section === 'Analytics') return <Analytics go={() => go('dp', 'Inventory Calculation')} />
      return <POOverview />
    }
    if (section === 'DRR & Aging') return <DrrAging />
    if (section === 'Analytics') return <DPAnalytics />
    return <InventoryCalc />
  })()

  const groupLabel = GROUPS.find((g) => g.key === route.module)!.label

  return (
    <div className={`grid h-full grid-cols-1 ${collapsed ? 'md:grid-cols-[68px_1fr]' : 'md:grid-cols-[248px_1fr]'}`}>
      {/* Left nav rail */}
      <aside className="hidden min-h-0 flex-col border-r border-line bg-surface md:flex">
        <div className="flex items-center gap-2.5 px-4 py-4">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-[13px] font-bold text-white">PF</div>
          {!collapsed && (
            <div className="leading-tight">
              <div className="font-serif text-[15px] font-medium text-ink-900">Post FG</div>
              <div className="text-[10px] uppercase tracking-widest text-ink-400">ERP</div>
            </div>
          )}
          <button onClick={() => setCollapsed((c) => !c)} className={`rounded-md p-1 text-ink-400 hover:bg-alt hover:text-ink-900 ${collapsed ? 'hidden' : 'ml-auto'}`} title="Collapse">
            <ChevronsLeft className="size-4" />
          </button>
        </div>

        <nav className="mt-1 min-h-0 flex-1 overflow-y-auto px-2.5 pb-4">
          {GROUPS.map((g) => {
            const activeGroup = route.module === g.key
            const Icon = g.icon
            const leaf = g.items.length === 0
            return (
              <div key={g.key} className="mb-0.5">
                <button
                  onClick={() => {
                    if (leaf || collapsed) go(g.key, g.items[0] ?? '')
                    else setOpen({ ...open, [g.key]: !open[g.key] })
                  }}
                  title={g.label}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                    activeGroup && (leaf || collapsed) ? 'bg-primary text-white' : activeGroup ? 'text-primary' : 'text-ink-900 hover:bg-alt'
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && <span className="flex-1 text-left">{g.label}</span>}
                  {!collapsed && leaf && pending > 0 && <span className={`tnum rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${activeGroup ? 'bg-white/20 text-white' : 'bg-crit-soft text-crit'}`}>{pending}</span>}
                  {!collapsed && !leaf && <ChevronDown className={`size-3.5 text-ink-400 transition-transform ${open[g.key] ? '' : '-rotate-90'}`} />}
                </button>
                {!collapsed && !leaf && open[g.key] && (
                  <div className="my-1 ml-[21px] border-l border-line pl-3">
                    {g.items.map((it) => {
                      const on = activeGroup && route.section === it
                      return (
                        <button
                          key={it}
                          onClick={() => go(g.key, it)}
                          className={`relative block w-full truncate rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${on ? 'bg-primary-soft font-medium text-primary' : 'text-ink-600 hover:bg-alt hover:text-ink-900'}`}
                        >
                          {on && <span className="absolute -left-[13px] top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />}
                          {it}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <div className="border-t border-line px-3 py-3">
          <div className="flex items-center gap-1.5 px-1 text-[11px] text-ink-600">
            <span className="size-1.5 rounded-full bg-ok" /> {!collapsed && 'Uniware connected'}
          </div>
          {collapsed && (
            <button onClick={() => setCollapsed(false)} className="mt-2 flex w-full justify-center rounded-md border border-line py-1.5 text-ink-600 hover:bg-alt" title="Expand">
              <ChevronsRight className="size-4" />
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-h-0 min-w-0 flex-col">
        <header className="flex items-center gap-3 border-b border-line bg-surface px-5 py-3">
          <select
            value={`${route.module}|${route.section}`}
            onChange={(e) => { const [m, s] = e.target.value.split('|'); go(m as Module, s) }}
            className="rounded-md border border-line px-2 py-1.5 text-xs md:hidden"
          >
            {GROUPS.map((g) => g.items.length ? (
              <optgroup key={g.key} label={g.label}>{g.items.map((it) => <option key={it} value={`${g.key}|${it}`}>{it}</option>)}</optgroup>
            ) : <option key={g.key} value={`${g.key}|`}>{g.label}</option>)}
          </select>

          <div className="hidden items-center gap-1.5 text-[12px] text-ink-400 md:flex">
            <span>{groupLabel}</span>
            {route.section && <><span>/</span><span className="font-medium text-ink-900">{route.section}</span></>}
          </div>

          <label className="relative ml-4 hidden lg:block">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-400" />
            <input placeholder="Search PO number, SKU, channel…" className="w-72 rounded-md border border-line bg-canvas py-1.5 pl-8 pr-3 text-xs outline-none focus:border-primary" />
          </label>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden items-center gap-1 rounded-md border border-line p-0.5 text-[11px] sm:flex">
              <span className="px-1.5 text-ink-400">Brand</span>
              {BRANDS.map((b) => (
                <button key={b} onClick={() => setBrand(b)} className={`rounded px-2 py-1 font-semibold transition-colors ${brand === b ? 'bg-primary text-white' : 'text-ink-600 hover:text-ink-900'}`}>{b}</button>
              ))}
            </div>
            <div className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-[12px] font-semibold text-primary">AK</div>
          </div>
        </header>

        <main className="min-w-0 flex-1 overflow-y-auto p-5 lg:p-6">
          <div key={`${route.module}-${route.section}`} className="mx-auto max-w-[1440px]">{page}</div>
        </main>
      </div>
    </div>
  )
}
