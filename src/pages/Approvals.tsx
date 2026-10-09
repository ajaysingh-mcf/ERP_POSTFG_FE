import { useState } from 'react'
import { ArrowRight, Check, X } from 'lucide-react'
import { Badge, Button, Drawer, PageTitle, SubTabs } from '../components/ui'
import { DataGrid, FilterPanel, SectionToolbar, exportRows, inputCls, useSection } from '../components/kit'
import { APPROVALS, type Approval, type ColKind } from '../lib/ops'

const COLS: [string, keyof Approval, ColKind][] = [['ID', 'id', 'mono'], ['Type', 'type', 'text'], ['Reference', 'ref', 'mono'], ['Field', 'field', 'text'], ['Module', 'module', 'text'], ['Raised by', 'by', 'text'], ['Raised at', 'at', 'mono']]

export default function Approvals() {
  const [items, setItems] = useState(APPROVALS)
  const [tab, setTab] = useState<Approval['status']>('Pending')
  const [sel, setSel] = useState<Approval | null>(null)
  const [comment, setComment] = useState('')
  const s = useSection<Approval>(items.filter((a) => a.status === tab), ['id', 'ref', 'by'])
  const decide = (status: 'Approved' | 'Rejected') => { if (!sel) return; setItems(items.map((a) => (a.id === sel.id ? { ...a, status, comment } : a))); setSel(null) }
  const n = (st: Approval['status']) => items.filter((a) => a.status === st).length
  return (
    <div className="space-y-5">
      <PageTitle title="Approvals" sub="Appointment changes, quantity edits, priority shifts, manual POs and master changes wait here for sign-off" />
      <SubTabs value={tab} onChange={setTab} tabs={[{ key: 'Pending', label: 'Pending', count: n('Pending'), danger: true }, { key: 'Approved', label: 'Approved', count: n('Approved') }, { key: 'Rejected', label: 'Rejected', count: n('Rejected') }]} />
      <SectionToolbar q={s.q} setQ={s.setQ} placeholder="Search ID, reference, requester…" filtersOpen={s.open} onToggleFilters={() => s.setOpen(!s.open)} activeFilters={s.active}
        entity="Approval decisions" onExport={(e) => exportRows('approvals', e, COLS, s.filtered)} />
      {s.open && <FilterPanel defs={[
        { key: 'type', label: 'Type', type: 'multi', options: ['Appointment change', 'Qty update', 'Channel priority', 'Manual PO upload', 'Master change', 'Logistics rate'] },
        { key: 'module', label: 'Module', type: 'multi', options: ['PO Overview', 'PO Working', 'PO Processing', 'Masters'] },
        { key: 'by', label: 'Raised by', type: 'text' },
      ]} value={s.filters} onApply={s.setFilters} onClose={() => s.setOpen(false)} />}
      <DataGrid cols={COLS} rows={s.filtered} rowKey={(r) => r.id} onRowClick={(r) => { setSel(r); setComment(r.comment ?? '') }}
        trailing={[{ label: 'Change', render: (r) => <span className="inline-flex items-center gap-1.5 font-mono text-[12px]"><span className="text-ink-400 line-through">{r.from}</span><ArrowRight className="size-3 text-ink-400" /><span className="font-medium">{r.to}</span></span> }]} />
      {sel && (
        <Drawer open onClose={() => setSel(null)} title={sel.type} sub={<><span className="font-mono">{sel.id}</span> · {sel.module} · by {sel.by}</>}
          footer={sel.status === 'Pending' ? <><Button icon={<X className="size-3.5" />} onClick={() => decide('Rejected')}>Reject</Button><Button variant="primary" icon={<Check className="size-3.5" />} onClick={() => decide('Approved')}>Approve</Button></> : <Badge tone={sel.status === 'Approved' ? 'ok' : 'crit'}>{sel.status}</Badge>}>
          <div className="text-[12px] text-ink-600">Reference</div>
          <div className="mb-4 font-mono text-[14px]">{sel.ref}</div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-[var(--radius-card)] border border-line p-4">
            <div><div className="text-[11px] uppercase tracking-wide text-ink-400">Current</div><div className="mt-1 font-mono text-[15px] text-ink-600">{sel.from}</div></div>
            <ArrowRight className="size-4 text-ink-400" />
            <div><div className="text-[11px] uppercase tracking-wide text-primary">Proposed</div><div className="mt-1 font-mono text-[15px] font-semibold">{sel.to}</div></div>
          </div>
          <div className="mt-2 text-[12px] text-ink-400">{sel.field}</div>
          <div className="mt-5 text-[12px] font-medium text-ink-600">Reason given</div>
          <p className="mt-1 rounded-[var(--radius)] bg-canvas p-3 text-[13px]">{sel.reason}</p>
          <div className="mt-5 mb-1 text-[12px] font-medium text-ink-600">Reviewer comment</div>
          <textarea rows={3} value={comment} disabled={sel.status !== 'Pending'} onChange={(e) => setComment(e.target.value)} className={`${inputCls} h-auto py-2`} />
        </Drawer>
      )}
    </div>
  )
}
