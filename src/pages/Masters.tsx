import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { AlertTriangle, History, Layers, Pencil, Plus, RefreshCw } from 'lucide-react'
import { SKU_MASTER } from '../lib/data'
import { OPS_CHANNELS, type ColKind } from '../lib/ops'
import { Badge, Button, Drawer, PageTitle, SubTabs } from '../components/ui'
import { DataGrid, FilterPanel, PrimaryBtn, SectionToolbar, exportRows, inputCls, useSection, type FilterDef } from '../components/kit'

type Row = Record<string, string | number>
type FieldDef = { key: string; label: string; options?: readonly string[]; type?: 'number' }

// ---- Seed data --------------------------------------------------------------
const CATS: [string, string, string][] = [
  ['Body Care', 'Body Butter', '100g'], ['Body Care', 'Body Scrub', '120g'], ['Body Care', 'Body Lotion', '140ml'], ['Face Care', 'Face Serum', '30ml'],
  ['Face Care', 'Sunscreen', '50ml'], ['Face Care', 'Face Scrub', '75g'], ['Hair Care', 'Shampoo', '250ml'], ['Men', 'Grooming Kit', '1 kit'],
]
const PEP_SKUS: Row[] = [
  ['100MCaf48', 'Naked & Rich Choco Body Butter_100 g', 'mCaffeine', 0, 299, '100MCaf48-RM1-PM1'],
  ['100MCaf48_WB', 'Naked & Rich Choco Body Butter_100 g Without Box', 'mCaffeine', 0, 299, ''],
  ['100SMCaf48', 'Naked & Rich Choco Body Butter _100g', 'mCaffeine', 0, 299, ''],
  ['120MCaf199', 'Coffee Body Scrub with Berries_120gm', 'mCaffeine', 1, 0, ''],
  ['120MCaf199_WB', 'Coffee Body Scrub with Berries_120gm_Without Box', 'mCaffeine', 1, 0, ''],
  ['140MCaf370_WB', 'Sweet Escape Perfume Body Lotion', 'mCaffeine', 2, 239, '140MCaf370-RM2-PM1'],
  ...SKU_MASTER.map((s, i) => [s.pepCode, s.productName, s.brand, [5, 4, 5, 3, 4, 7, 3, 6][i], s.mrp, i % 3 ? `${s.pepCode}-RM1-PM1` : ''] as [string, string, string, number, number, string]),
].map(([code, name, brand, ci, mrp, recipe], i) => {
  const [category, sub, filling] = CATS[ci as number]
  return { code, name, brand, type: i % 5 === 4 ? 'Combo' : 'Main Unit', category, sub, filling, mrp, gst: '18.00%', recipe, status: i === 11 ? 'Inactive' : 'Active' }
})

const CH_CODE: Record<string, string> = { Zepto: 'ZP', Blinkit: 'BL', Swiggy: 'SW', BigBasket: 'BB', Amazon: 'AMZ', Flipkart: 'FK', Nykaa: 'NYK', Myntra: 'MYN', Firstcry: 'FC', Purplle: 'PUR' }
const MARGIN: Record<string, number> = { Zepto: 27, Blinkit: 28, Swiggy: 27, BigBasket: 25, Amazon: 30, Flipkart: 30, Nykaa: 32, Myntra: 35, Firstcry: 30, Purplle: 30 }
const CHANNEL_SKUS: Row[] = PEP_SKUS.flatMap((p, i) =>
  OPS_CHANNELS.filter((_, j) => (i + j) % 3 !== 1).map((ch, j) => {
    const mrp = Number(p.mrp) || 299, m = MARGIN[ch]
    return {
      channel: ch, channelSku: `${CH_CODE[ch]}-${String(10100000 + i * 137 + j * 41).slice(0, 8)}`, pepCode: p.code, name: p.name, brand: p.brand,
      mrp, margin: m, rate: Math.round(mrp * (1 - m / 100) * 100) / 100, ean: `89060876${String(50000 + i * 31).padStart(5, '0')}`,
      status: (i + j) % 11 === 0 ? 'Unmapped' : (i + j) % 13 === 0 ? 'Discontinued' : 'Live',
    }
  }),
)

const CUSTOMERS: Row[] = OPS_CHANNELS.map((c, i) => ({
  channel: c, legal: `${c} ${['Marketplace Pvt Ltd', 'Commerce Pvt Ltd', 'Retail LLP'][i % 3]}`,
  type: ['Zepto', 'Blinkit', 'Swiggy', 'BigBasket'].includes(c) ? 'Quick commerce' : 'Marketplace',
  gstin: `${['27', '29', '06', '07'][i % 4]}AAB${'CDEFGHJKLM'[i]}${1000 + i * 7}K1Z${i}`, terms: `${[30, 45, 60][i % 3]} days`, margin: MARGIN[c], poSource: i % 3 === 0 ? 'API' : i % 3 === 1 ? 'Email' : 'Portal', status: 'Active',
}))

const PEP_WH: Row[] = [
  ['HYP_B2B_GGN', 'KREATIVE', 'Gurgaon', 'Gurugram, Haryana', 'MWH', '06AAJCK9697F1ZW', '06AAJCK9697F1ZW'],
  ['GGN_WAREHOUSE', 'PEP', 'Gurgaon', 'Gurugram, Haryana', 'MWH', '06AAICP2804J1ZG', '06AAICP2804J1ZG'],
  ['HYP_B2B_MUM2', 'KREATIVE', 'Mumbai', 'Mumbai, Maharashtra', 'MWH', '27AAJCK9697F1ZS', '27AAJCK9697F1ZS'],
  ['MUM_WAREHOUSE2', 'PEP', 'Mumbai', 'Mumbai, Maharashtra', 'MWH', '27AAICP2804J1ZC', '27AAICP2804J1ZC'],
  ['HYP_AHMD', 'KREATIVE', 'Ahmedabad', 'Ahmedabad, Gujarat', 'CWH', '27AAJCK9697F1ZS', '24AAICP2804J1ZI'],
  ['mCaff_Ahmedabad', 'PEP', 'Ahmedabad', 'Ahmedabad, Gujarat', 'CWH', '24AAICP2804J1ZI', '24AAICP2804J1ZI'],
  ['HYP_SRBGLR', 'KREATIVE', 'Bangalore', 'Bengaluru, Karnataka', 'CWH', '27AAJCK9697F1ZS', '29AAICP2804J1Z8'],
  ['mCaff_Bangalore2', 'PEP', 'Bangalore', 'Bengaluru, Karnataka', 'CWH', '29AAICP2804J1Z8', ''],
  ['HYP_SPCHN', 'KREATIVE', 'Chennai', 'Chennai, Tamil Nadu', 'CWH', '', ''],
  ['Mcaff_Chennai', 'PEP', 'Chennai', 'Chennai, Tamil Nadu', 'CWH', '', ''],
].map(([facility, entity, location, region, type, billTo, shipTo]) => ({ facility, entity, location, region, type, billTo, shipTo, status: 'Active', remarks: '' }))

const CH_WH_SEED: [string, string, string, string][] = [
  ['Zepto', 'Hyderabad', 'Telangana', '500032'], ['Zepto', 'Mumbai', 'Maharashtra', '400072'], ['Blinkit', 'Gurgaon', 'Haryana', '122001'], ['Blinkit', 'Bengaluru', 'Karnataka', '562123'],
  ['Swiggy', 'Pune', 'Maharashtra', '411019'], ['BigBasket', 'Bengaluru', 'Karnataka', '560099'], ['Amazon', 'Delhi', 'Delhi', '110037'], ['Amazon', 'Kolkata', 'West Bengal', '711302'],
  ['Flipkart', 'Hyderabad', 'Telangana', '501401'], ['Nykaa', 'Mumbai', 'Maharashtra', '421302'], ['Myntra', 'Bengaluru', 'Karnataka', '562114'], ['Purplle', 'Chennai', 'Tamil Nadu', '600056'],
]
const CH_WH: Row[] = CH_WH_SEED.map(([channel, city, state, pin], i) => ({
  code: `${CH_CODE[channel]}_${city.slice(0, 3).toUpperCase()}_${String(i + 1).padStart(2, '0')}`, channel, city, state, pincode: pin,
  servedBy: PEP_WH[[3, 3, 1, 7, 3, 7, 1, 1, 9, 3, 7, 9][i]].facility, apptPortal: i % 2 ? 'Channel portal' : 'Email', status: i === 10 ? 'Inactive' : 'Active',
}))

// ---- Config per master ------------------------------------------------------
type Cfg = {
  title: string; sub: string; key: string; entity: string; addLabel: string; search: string[]; placeholder: string
  cols: [string, string, ColKind][]; fields: FieldDef[]; filters: FilterDef[]
  trailing?: { label: string; render: (r: Row) => ReactNode }[]
}
const tag = (v: unknown, cls = 'bg-alt text-ink-900') => <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{String(v)}</span>
const status = (r: Row) => <Badge tone={r.status === 'Active' || r.status === 'Live' ? 'ok' : r.status === 'Unmapped' ? 'warn' : 'neutral'}>{String(r.status)}</Badge>
const STATUS: FieldDef = { key: 'status', label: 'Status', options: ['Active', 'Inactive'] }

const CFG: Record<string, Cfg> = {
  pep: {
    title: 'PEP SKU master', sub: 'Every sellable PEP SKU with its Uniware name, classification, MRP, GST and recipe', key: 'code', entity: 'PEP SKUs', addLabel: 'Add SKU',
    search: ['code', 'name', 'category', 'sub'], placeholder: 'Search SKU code, Uniware name, category…',
    cols: [['SKU Code', 'code', 'mono'], ['Uniware Name', 'name', 'text'], ['Brand', 'brand', 'text'], ['SKU Type', 'type', 'text'], ['Category', 'category', 'text'], ['Sub-Category', 'sub', 'text'], ['Filling', 'filling', 'text'], ['MRP', 'mrp', 'money'], ['GST', 'gst', 'text']],
    fields: [{ key: 'code', label: 'SKU code' }, { key: 'name', label: 'Uniware name' }, { key: 'brand', label: 'Brand', options: ['mCaffeine', 'Hyphen'] }, { key: 'type', label: 'SKU type', options: ['Main Unit', 'Combo', 'Free Gift'] },
      { key: 'category', label: 'Category', options: ['Body Care', 'Face Care', 'Hair Care', 'Men'] }, { key: 'sub', label: 'Sub-category' }, { key: 'filling', label: 'Filling' }, { key: 'mrp', label: 'MRP (₹)', type: 'number' },
      { key: 'gst', label: 'GST', options: ['18.00%', '12.00%', '5.00%'] }, { key: 'recipe', label: 'Recipe code' }, STATUS],
    filters: [{ key: 'brand', label: 'Brand', type: 'multi', options: ['mCaffeine', 'Hyphen'] }, { key: 'type', label: 'SKU Type', type: 'multi', options: ['Main Unit', 'Combo', 'Free Gift'] },
      { key: 'category', label: 'Category', type: 'multi', options: ['Body Care', 'Face Care', 'Hair Care', 'Men'] }, { key: 'status', label: 'Status', type: 'multi', options: ['Active', 'Inactive'] }],
    trailing: [
      { label: 'Recipe', render: (r) => r.recipe ? <span className="font-mono text-[12.5px]">{r.recipe}</span> : <span className="inline-flex items-center gap-1 text-[12px] text-warn"><AlertTriangle className="size-3.5" />No Recipe</span> },
      { label: 'Status', render: status },
    ],
  },
  channelSku: {
    title: 'Channel SKU master', sub: 'How each channel lists a PEP SKU — channel code, margin and the rate we bill at', key: 'channelSku', entity: 'Channel SKUs', addLabel: 'Map channel SKU',
    search: ['channelSku', 'pepCode', 'name', 'ean'], placeholder: 'Search channel SKU, PEP code, product, EAN…',
    cols: [['Channel SKU', 'channelSku', 'mono'], ['Channel', 'channel', 'text'], ['PEP Code', 'pepCode', 'mono'], ['Product Name', 'name', 'text'], ['Brand', 'brand', 'text'], ['MRP', 'mrp', 'money'], ['Margin %', 'margin', 'num'], ['Rate After Margin', 'rate', 'money'], ['EAN', 'ean', 'mono']],
    fields: [{ key: 'channel', label: 'Channel', options: OPS_CHANNELS }, { key: 'channelSku', label: 'Channel SKU code' }, { key: 'pepCode', label: 'PEP SKU code', options: PEP_SKUS.map((p) => String(p.code)) },
      { key: 'mrp', label: 'MRP (₹)', type: 'number' }, { key: 'margin', label: 'Margin %', type: 'number' }, { key: 'ean', label: 'EAN' }, { key: 'status', label: 'Status', options: ['Live', 'Discontinued', 'Unmapped'] }],
    filters: [{ key: 'channel', label: 'Channel', type: 'multi', options: OPS_CHANNELS }, { key: 'brand', label: 'Brand', type: 'multi', options: ['mCaffeine', 'Hyphen'] }, { key: 'status', label: 'Status', type: 'multi', options: ['Live', 'Discontinued', 'Unmapped'] }],
    trailing: [{ label: 'Status', render: status }],
  },
  customer: {
    title: 'Channel / Customer master', sub: 'Legal entity, billing and commercial terms per channel', key: 'channel', entity: 'Channels', addLabel: 'Add channel',
    search: ['channel', 'legal', 'gstin'], placeholder: 'Search channel, legal name, GSTIN…',
    cols: [['Channel', 'channel', 'text'], ['Legal Name', 'legal', 'text'], ['Type', 'type', 'text'], ['Billing GSTIN', 'gstin', 'mono'], ['Payment Terms', 'terms', 'text'], ['Default Margin %', 'margin', 'num'], ['PO Source', 'poSource', 'text']],
    fields: [{ key: 'channel', label: 'Channel' }, { key: 'legal', label: 'Legal name' }, { key: 'type', label: 'Type', options: ['Quick commerce', 'Marketplace', 'Modern trade'] }, { key: 'gstin', label: 'Billing GSTIN' },
      { key: 'terms', label: 'Payment terms' }, { key: 'margin', label: 'Default margin %', type: 'number' }, { key: 'poSource', label: 'PO source', options: ['API', 'Email', 'Portal'] }, STATUS],
    filters: [{ key: 'type', label: 'Type', type: 'multi', options: ['Quick commerce', 'Marketplace', 'Modern trade'] }, { key: 'poSource', label: 'PO Source', type: 'multi', options: ['API', 'Email', 'Portal'] }],
    trailing: [{ label: 'Status', render: status }],
  },
  pepWh: {
    title: 'PEP warehouses', sub: 'Our dispatch facilities and their Unicommerce code per legal entity', key: 'facility', entity: 'PEP warehouses', addLabel: 'Add warehouse',
    search: ['facility', 'location', 'entity', 'billTo', 'shipTo', 'remarks'], placeholder: 'Search facility, location, entity, GSTIN or remarks…',
    cols: [['Facility', 'facility', 'mono']],
    fields: [{ key: 'facility', label: 'Facility code (Unicommerce)' }, { key: 'entity', label: 'Entity', options: ['PEP', 'KREATIVE'] }, { key: 'location', label: 'Location' }, { key: 'region', label: 'City, State' },
      { key: 'type', label: 'Type', options: ['MWH', 'CWH'] }, { key: 'billTo', label: 'Bill-to GSTIN' }, { key: 'shipTo', label: 'Ship-to GSTIN' }, STATUS, { key: 'remarks', label: 'Remarks' }],
    filters: [{ key: 'entity', label: 'Entity', type: 'multi', options: ['PEP', 'KREATIVE'] }, { key: 'type', label: 'Type', type: 'multi', options: ['MWH', 'CWH'] }, { key: 'status', label: 'Status', type: 'multi', options: ['Active', 'Inactive'] }],
    trailing: [
      { label: 'Entity', render: (r) => tag(r.entity) },
      { label: 'Location', render: (r) => <span className="whitespace-nowrap">{r.location} <span className="text-[12px] text-ink-400">{r.region}</span></span> },
      { label: 'Type', render: (r) => tag(r.type, r.type === 'MWH' ? 'bg-primary-soft text-primary' : 'bg-alt text-ink-900') },
      { label: 'Bill-To GSTIN', render: (r) => r.billTo ? <span className="font-mono text-[12.5px]">{r.billTo}</span> : <span className="text-ink-400">—</span> },
      { label: 'Ship-To GSTIN', render: (r) => r.shipTo ? <span className="font-mono text-[12.5px]">{r.shipTo}</span> : <span className="text-ink-400">—</span> },
      { label: 'Status', render: status },
      { label: 'Remarks', render: (r) => r.remarks ? String(r.remarks) : <span className="text-ink-400">—</span> },
    ],
  },
  chWh: {
    title: 'Channel warehouses', sub: 'Channel delivery locations (DCs / dark-store hubs) and which PEP facility serves them', key: 'code', entity: 'Channel warehouses', addLabel: 'Add channel warehouse',
    search: ['code', 'channel', 'city', 'pincode'], placeholder: 'Search code, channel, city, pincode…',
    cols: [['Warehouse Code', 'code', 'mono'], ['Channel', 'channel', 'text'], ['City', 'city', 'text'], ['State', 'state', 'text'], ['Pincode', 'pincode', 'mono'], ['Served By', 'servedBy', 'mono'], ['Appointment Via', 'apptPortal', 'text']],
    fields: [{ key: 'channel', label: 'Channel', options: OPS_CHANNELS }, { key: 'code', label: 'Warehouse code' }, { key: 'city', label: 'City' }, { key: 'state', label: 'State' }, { key: 'pincode', label: 'Pincode' },
      { key: 'servedBy', label: 'Served by (PEP facility)', options: PEP_WH.map((w) => String(w.facility)) }, { key: 'apptPortal', label: 'Appointment via', options: ['Channel portal', 'Email'] }, STATUS],
    filters: [{ key: 'channel', label: 'Channel', type: 'multi', options: OPS_CHANNELS }, { key: 'servedBy', label: 'Served By', type: 'multi', options: PEP_WH.map((w) => String(w.facility)) }, { key: 'status', label: 'Status', type: 'multi', options: ['Active', 'Inactive'] }],
    trailing: [{ label: 'Status', render: status }],
  },
}
const SEED: Record<string, Row[]> = { pep: PEP_SKUS, channelSku: CHANNEL_SKUS, customer: CUSTOMERS, pepWh: PEP_WH, chWh: CH_WH }

export default function Masters({ tab = 'PEP SKU master' }: { tab?: string }) {
  const [data, setData] = useState(SEED)
  const [wh, setWh] = useState<'pepWh' | 'chWh'>('pepWh')
  const id = tab === 'Channel SKU master' ? 'channelSku' : tab === 'Channel / Customer master' ? 'customer' : tab === 'Warehouses' ? wh : 'pep'
  const save = (k: string, r: Row, prevKey?: string) => {
    const key = CFG[k].key
    setData((d) => ({ ...d, [k]: prevKey !== undefined ? d[k].map((x) => (x[key] === prevKey ? r : x)) : [r, ...d[k]] }))
  }
  return (
    <div className="space-y-5">
      <PageTitle
        title={tab === 'Warehouses' ? 'Warehouses' : CFG[id].title}
        sub={tab === 'Warehouses' ? 'Our dispatch facilities and the channel locations we deliver to' : CFG[id].sub}
        right={<><span className="hidden text-[11px] text-ink-400 sm:inline">Synced from Uniware · 2 min ago</span><Button icon={<RefreshCw className="size-3.5" />}>Sync now</Button></>}
      />
      {tab === 'Warehouses' && (
        <SubTabs value={wh} onChange={setWh} tabs={[{ key: 'pepWh', label: 'PEP warehouses', count: data.pepWh.length }, { key: 'chWh', label: 'Channel warehouses', count: data.chWh.length }]} />
      )}
      <MasterTable key={id} id={id} rows={data[id]} onSave={(r, prev) => save(id, r, prev)} />
    </div>
  )
}

function MasterTable({ id, rows, onSave }: { id: string; rows: Row[]; onSave: (r: Row, prevKey?: string) => void }) {
  const c = CFG[id]
  const s = useSection<Row>(rows, c.search)
  const [edit, setEdit] = useState<{ row: Row; prev?: string } | null>(null)
  const [channel, setChannel] = useState('All')
  const counts = useMemo(() => Object.fromEntries(OPS_CHANNELS.map((ch) => [ch, rows.filter((r) => r.channel === ch).length])), [rows])
  const view = id === 'channelSku' && channel !== 'All' ? s.filtered.filter((r) => r.channel === channel) : s.filtered
  const blank = () => Object.fromEntries(c.fields.map((f) => [f.key, f.options ? (id === 'channelSku' && f.key === 'channel' && channel !== 'All' ? channel : f.options[0]) : ''])) as Row

  return (
    <div className="space-y-3">
      {id === 'channelSku' && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {['All', ...OPS_CHANNELS].map((ch) => (
            <button key={ch} onClick={() => setChannel(ch)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors ${channel === ch ? 'border-primary bg-primary text-white' : 'border-line bg-surface text-ink-600 hover:border-primary/50 hover:text-ink-900'}`}>
              {ch}<span className={`tnum text-[11px] ${channel === ch ? 'text-white/70' : 'text-ink-400'}`}>{ch === 'All' ? rows.length : counts[ch]}</span>
            </button>
          ))}
        </div>
      )}
      <SectionToolbar q={s.q} setQ={s.setQ} placeholder={c.placeholder} filtersOpen={s.open} onToggleFilters={() => s.setOpen(!s.open)} activeFilters={s.active}
        entity={c.entity} onExport={(e) => exportRows(id, e, c.fields.map((f) => [f.label, f.key, 'text'] as [string, string, ColKind]), view)}
        primary={<PrimaryBtn icon={<Plus className="size-4" />} onClick={() => setEdit({ row: blank() })}>{c.addLabel}</PrimaryBtn>} />
      {s.open && <FilterPanel defs={c.filters} value={s.filters} onApply={s.setFilters} onClose={() => s.setOpen(false)} />}
      <DataGrid cols={c.cols} rows={view} rowKey={(r) => String(r[c.key])} sticky={1}
        onRowClick={(r) => setEdit({ row: r, prev: String(r[c.key]) })}
        trailing={[
          ...(c.trailing ?? []),
          { label: 'Actions', render: (r) => (
            <span className="flex items-center gap-1 text-ink-600" onClick={(e) => e.stopPropagation()}>
              <IconBtn title="Edit" onClick={() => setEdit({ row: r, prev: String(r[c.key]) })}><Pencil className="size-3.5" /></IconBtn>
              {id === 'pep' && <><IconBtn title="History"><History className="size-3.5" /></IconBtn><IconBtn title="Channel listings"><Layers className="size-3.5" /></IconBtn></>}
            </span>
          ) },
        ]} />
      {edit && <EditDrawer cfg={c} row={edit.row} isNew={edit.prev === undefined} onClose={() => setEdit(null)} onSave={(r) => { onSave(r, edit.prev); setEdit(null) }} />}
    </div>
  )
}

const IconBtn = ({ children, title, onClick }: { children: ReactNode; title: string; onClick?: () => void }) => (
  <button title={title} onClick={onClick} className="rounded-md p-1.5 hover:bg-alt hover:text-ink-900">{children}</button>
)

function EditDrawer({ cfg, row, isNew, onClose, onSave }: { cfg: Cfg; row: Row; isNew: boolean; onClose: () => void; onSave: (r: Row) => void }) {
  const [f, setF] = useState<Row>(row)
  const ok = String(f[cfg.key] ?? '').trim().length > 0
  const commit = () => {
    if (!ok) return
    const r = { ...f }
    cfg.fields.forEach((d) => { if (d.type === 'number') r[d.key] = Number(r[d.key]) || 0 })
    if ('margin' in r && 'mrp' in r && 'rate' in row) r.rate = Math.round(Number(r.mrp) * (1 - Number(r.margin) / 100) * 100) / 100
    onSave(r)
  }
  return (
    <Drawer open onClose={onClose} title={isNew ? cfg.addLabel : <span className="font-mono">{String(row[cfg.key])}</span>} sub={isNew ? cfg.title : `Edit · ${cfg.title} · changes route to Approvals`}
      footer={<><Button onClick={onClose}>Cancel</Button><Button variant="primary" onClick={commit}>{isNew ? 'Add' : 'Save changes'}</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        {cfg.fields.map((d) => (
          <label key={d.key} className={d.key === 'name' || d.key === 'legal' || d.key === 'remarks' ? 'col-span-2' : ''}>
            <div className="mb-1 text-[12px] font-medium text-ink-600">{d.label}{d.key === cfg.key && <span className="text-crit"> *</span>}</div>
            {d.options ? (
              <select value={String(f[d.key] ?? '')} onChange={(e) => setF({ ...f, [d.key]: e.target.value })} className={inputCls}>{d.options.map((o) => <option key={o}>{o}</option>)}</select>
            ) : (
              <input type={d.type ?? 'text'} value={String(f[d.key] ?? '')} onChange={(e) => setF({ ...f, [d.key]: e.target.value })} className={`${inputCls} ${/code|gstin|billTo|shipTo|facility|channelSku|ean|pincode/i.test(d.key) ? 'font-mono' : ''}`} />
            )}
          </label>
        ))}
      </div>
    </Drawer>
  )
}
