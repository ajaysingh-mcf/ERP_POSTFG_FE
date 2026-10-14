import { useEffect, useRef, useState } from 'react'
import type { ComponentType, ReactNode } from 'react'
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router'
import { BadgeCheck, ChevronDown, ChevronsLeft, ChevronsRight, Database, LineChart, LogOut, Search, Truck } from 'lucide-react'
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
import { APPROVALS, CHANNEL_PRIORITY_DEFAULT } from './lib/ops'
import { useAuth, type User } from './auth/AuthContext'
import { FullPageMessage } from './auth/RequireAuth'
import { ACCESS, UI_TEXT } from './constants/auth'
import { DummyDataStrip } from './components/DummyData'
import { HOME_PATH, MASTER_TAB_BY_PATH, NAV_GROUPS, PATHS, isDummyPage, type NavGroup } from './constants/pages'

const GROUP_ICONS: Record<string, ComponentType<{ className?: string }>> = {
  [PATHS.MASTERS]: Database,
  [PATHS.OPERATIONS]: Truck,
  [PATHS.PLANNING]: LineChart,
  [PATHS.APPROVALS]: BadgeCheck,
}

const BRANDS = ['All', 'mCaffeine', 'Hyphen'] as const
const pending = APPROVALS.filter((a) => a.status === 'Pending').length

/** The group a path belongs to, and its item (groups with children). */
const findRoute = (pathname: string) => {
  for (const g of NAV_GROUPS) {
    if (pathname === g.key || pathname.startsWith(`${g.key}/`)) return { group: g, item: g.items.find((it) => it.path === pathname) }
  }
  return null
}

export default function App() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const auth = useAuth()
  const [open, setOpen] = useState<Record<string, boolean>>({ [PATHS.MASTERS]: false, [PATHS.OPERATIONS]: true, [PATHS.PLANNING]: true, [PATHS.APPROVALS]: false })
  const [collapsed, setCollapsed] = useState(false)
  const [prio, setPrio] = useState<Record<string, number>>(CHANNEL_PRIORITY_DEFAULT)
  const [brand, setBrand] = useState<(typeof BRANDS)[number]>('All')

  // Sidebar shows only what the user may see: access "none" hides a page, and a group with nothing visible hides too.
  const canSee = (path: string) => auth.accessFor(path) !== ACCESS.NONE
  const groups: NavGroup[] = NAV_GROUPS.map((g) => ({ ...g, items: g.items.filter((it) => canSee(it.path)) })).filter((g) =>
    g.items.length > 0 || (NAV_GROUPS.find((n) => n.key === g.key)!.items.length === 0 && canSee(g.key)),
  )
  const firstPath = (g: NavGroup) => g.items[0]?.path ?? g.key

  const current = findRoute(pathname)
  const viewOnly = current !== null && auth.accessFor(current.item?.path ?? current.group.key) === ACCESS.VIEWER
  const dummy = current !== null && isDummyPage(current.item?.path ?? current.group.key)

  const pages: [string, ReactNode][] = [
    ...Object.entries(MASTER_TAB_BY_PATH).map(([path, tab]): [string, ReactNode] => [path, <Masters tab={tab} />]),
    [PATHS.PO_OVERVIEW, <POOverview />],
    [PATHS.PO_REVIEW, <POProcessing />],
    [PATHS.PO_WORKING, <POWorking prio={prio} setPrio={setPrio} />],
    [PATHS.SKUS_SHORT, <ShortSkus priority={prio} />],
    [PATHS.OPS_ANALYTICS, <Analytics go={() => navigate(PATHS.INVENTORY)} />],
    [PATHS.INVENTORY, <InventoryCalc />],
    [PATHS.DRR_AGING, <DrrAging />],
    [PATHS.PLANNING_ANALYTICS, <DPAnalytics />],
    [PATHS.APPROVALS, <Approvals />],
  ]

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
          {groups.map((g) => {
            const activeGroup = current?.group.key === g.key
            const Icon = GROUP_ICONS[g.key]
            const leaf = g.items.length === 0
            return (
              <div key={g.key} className="mb-0.5">
                <button
                  onClick={() => {
                    if (leaf || collapsed) navigate(firstPath(g))
                    else setOpen({ ...open, [g.key]: !open[g.key] })
                  }}
                  title={g.label}
                  className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                    activeGroup && (leaf || collapsed) ? 'bg-primary text-white' : activeGroup ? 'text-primary' : 'text-ink-900 hover:bg-alt'
                  }`}
                >
                  <Icon className="size-4 shrink-0" />
                  {!collapsed && <span className="flex-1 text-left">{g.label}{leaf && isDummyPage(g.key) && <DummyDot />}</span>}
                  {!collapsed && leaf && pending > 0 && <span className={`tnum rounded-full px-1.5 py-0.5 text-[10px] font-semibold leading-none ${activeGroup ? 'bg-white/20 text-white' : 'bg-crit-soft text-crit'}`}>{pending}</span>}
                  {!collapsed && !leaf && <ChevronDown className={`size-3.5 text-ink-400 transition-transform ${open[g.key] ? '' : '-rotate-90'}`} />}
                </button>
                {!collapsed && !leaf && open[g.key] && (
                  <div className="my-1 ml-[21px] border-l border-line pl-3">
                    {g.items.map((it) => {
                      const on = pathname === it.path
                      return (
                        <button
                          key={it.path}
                          onClick={() => navigate(it.path)}
                          className={`relative block w-full truncate rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${on ? 'bg-primary-soft font-medium text-primary' : 'text-ink-600 hover:bg-alt hover:text-ink-900'}`}
                        >
                          {on && <span className="absolute -left-[13px] top-1.5 bottom-1.5 w-0.5 rounded-full bg-primary" />}
                          {it.label}
                          {isDummyPage(it.path) && <DummyDot />}
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
          <select value={pathname} onChange={(e) => navigate(e.target.value)} className="rounded-md border border-line px-2 py-1.5 text-xs md:hidden">
            {groups.map((g) => g.items.length ? (
              <optgroup key={g.key} label={g.label}>{g.items.map((it) => <option key={it.path} value={it.path}>{it.label}</option>)}</optgroup>
            ) : <option key={g.key} value={g.key}>{g.label}</option>)}
          </select>

          {current && (
            <div className="hidden items-center gap-1.5 text-[12px] text-ink-400 md:flex">
              <span>{current.group.label}</span>
              {current.item && <><span>/</span><span className="font-medium text-ink-900">{current.item.label}</span></>}
              {viewOnly && <span className="ml-2 rounded-full bg-warn-soft px-2 py-0.5 text-[10px] font-semibold text-warn">{UI_TEXT.VIEW_ONLY}</span>}
            </div>
          )}

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
            {auth.status === 'signedIn' && <UserMenu user={auth.user} onLogout={auth.logout} />}
          </div>
        </header>

        <main className={`min-w-0 flex-1 overflow-y-auto p-5 lg:p-6 ${dummy ? 'dummy-data bg-canvas' : ''}`}>
          <div key={pathname} className="mx-auto max-w-[1440px]">
            {dummy && <DummyDataStrip />}
            <Routes>
              <Route index element={<Navigate to={HOME_PATH} replace />} />
              {NAV_GROUPS.filter((g) => g.items.length > 0).map((g) => (
                <Route key={g.key} path={g.key} element={<Navigate to={g.items[0].path} replace />} />
              ))}
              {pages.map(([path, element]) => (
                <Route key={path} path={path} element={canSee(path) ? element : <FullPageMessage text={UI_TEXT.NO_ACCESS} />} />
              ))}
              <Route path="*" element={<FullPageMessage text={UI_TEXT.NOT_FOUND} />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  )
}

function UserMenu({ user, onLogout }: { user: User; onLogout: () => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const initials =
    user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join('') || user.email[0]!.toUpperCase()

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} title={user.email} className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-[12px] font-semibold text-primary">
        {initials}
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-64 rounded-[var(--radius-card)] border border-line bg-surface p-3 shadow-lg">
          <div className="text-[13px] font-medium text-ink-900">{user.name}</div>
          <div className="truncate text-[12px] text-ink-600">{user.email}</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {user.roles.map((r) => (
              <span key={r} className="rounded-full bg-alt px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-600">{r}</span>
            ))}
          </div>
          <button onClick={onLogout} className="mt-3 flex w-full items-center gap-2 rounded-md border border-line px-3 py-1.5 text-[12px] font-semibold text-ink-900 hover:bg-alt">
            <LogOut className="size-3.5" /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function DummyDot() {
  return <span title="Dummy data (dev)" className="ml-1.5 inline-block size-1.5 rounded-full bg-amber-400 align-middle" />
}
