import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown, Search } from 'lucide-react'
import type { PoReviewSkuOption } from '../../api/poReview'

/*
 * The "Map SKU" picker of PO Review (2026-10-15, user: the browser's list took too much space, wanted a search with
 * text match). A small field; the list opens in a compact panel (portal, so the line table never cuts it; upward when
 * there is no room below) with a search box: every word typed must appear in the PEP code, SKU name or channel SKU
 * (any order, any case), matches highlighted. Arrow keys + Enter, Esc / click outside closes. Long lists show the first
 * SHOW_MAX matches and ask to type more.
 */

const PANEL_W = 340
const PANEL_H = 300
const SHOW_MAX = 50
const POP_MS = 150

const words = (q: string) => q.trim().toLowerCase().split(/\s+/).filter(Boolean)
const haystack = (o: PoReviewSkuOption) => [o.pepCode, o.skuName ?? '', o.channelSkuCode ?? ''].join(' ').toLowerCase()

/** The text with every searched word marked. */
function Marked({ text, q }: { text: string; q: string[] }) {
  if (!q.length || !text) return <>{text}</>
  const re = new RegExp(`(${q.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi')
  const parts: ReactNode[] = text.split(re).map((p, i) => (i % 2 ? <mark key={i} className="rounded-sm bg-warn-soft px-0 font-semibold text-ink-900">{p}</mark> : p))
  return <>{parts}</>
}

export function SkuPicker({ value, options, onChange, disabled, invalid }: {
  value: string; options: PoReviewSkuOption[]; onChange: (pep: string) => void; disabled?: boolean; invalid?: boolean
}) {
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null)
  const [leaving, setLeaving] = useState(false)
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const btn = useRef<HTMLButtonElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const terms = useMemo(() => words(q), [q])
  const matches = useMemo(() => (terms.length ? options.filter((o) => { const h = haystack(o); return terms.every((w) => h.includes(w)) }) : options), [options, terms])
  const shown = matches.slice(0, SHOW_MAX)
  const current = options.find((o) => o.pepCode === value)

  const open = () => {
    const r = btn.current!.getBoundingClientRect()
    const up = r.bottom + PANEL_H + 8 > window.innerHeight && r.top - PANEL_H - 8 > 0
    setQ('')
    setActive(Math.max(0, options.findIndex((o) => o.pepCode === value)))
    setPos({ top: up ? r.top - PANEL_H - 4 : r.bottom + 4, left: Math.min(Math.max(8, r.left), window.innerWidth - PANEL_W - 8), up })
  }
  const close = (now = false) => {
    if (!pos) return
    if (now) { setPos(null); setLeaving(false); return }
    setLeaving(true)
    setTimeout(() => { setPos(null); setLeaving(false) }, POP_MS)
  }
  const pick = (pep: string) => { onChange(pep); close(); btn.current?.focus() }

  useEffect(() => {
    if (!pos) return
    const onDown = (e: MouseEvent) => { const t = e.target as Node; if (!box.current?.contains(t) && !btn.current?.contains(t)) close() }
    const onMove = (e: Event) => { if (!box.current?.contains(e.target as Node)) close(true) }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('scroll', onMove, true)
    window.addEventListener('resize', onMove)
    return () => { document.removeEventListener('mousedown', onDown); window.removeEventListener('scroll', onMove, true); window.removeEventListener('resize', onMove) }
  })
  // keep the highlighted row in view while using the arrow keys
  useEffect(() => { listRef.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' }) }, [active])

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(shown.length - 1, i + 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)) }
    if (e.key === 'Enter' && shown[active]) { e.preventDefault(); pick(shown[active].pepCode) }
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); btn.current?.focus() }
  }

  return (
    <>
      <button ref={btn} type="button" disabled={disabled} onClick={() => (pos ? close() : open())} title={current?.skuName ?? undefined}
        className={`flex h-8 w-[200px] items-center gap-1.5 rounded-md border bg-surface px-2 text-left font-mono text-[12px] transition-[border-color,box-shadow] duration-150 disabled:bg-alt ${pos && !leaving ? 'border-primary ring-2 ring-primary/15' : invalid ? 'border-crit/60' : 'border-line hover:border-ink-400'}`}>
        <span className={`min-w-0 flex-1 truncate ${value ? 'text-ink-900' : 'text-ink-400'}`}>{value || 'Map SKU…'}</span>
        <ChevronDown className={`size-3.5 shrink-0 text-ink-400 transition-transform duration-150 ${pos && !leaving ? 'rotate-180' : ''}`} />
      </button>
      {pos && createPortal(
        <div ref={box} onKeyDown={onKey} style={{ top: pos.top, left: pos.left, width: PANEL_W, height: PANEL_H }}
          className={`fixed z-[100] flex flex-col rounded-[var(--radius)] border border-line bg-surface shadow-lg ${pos.up ? 'origin-bottom' : 'origin-top'} ${leaving ? 'pf-pop-out' : 'pf-pop-in'}`}>
          <label className="flex items-center gap-2 border-b border-line px-2.5 py-2">
            <Search className="size-3.5 shrink-0 text-ink-400" />
            <input autoFocus value={q} onChange={(e) => { setQ(e.target.value); setActive(0) }} placeholder="Search code, name or channel SKU…"
              className="w-full bg-transparent text-[12.5px] outline-none" />
            <span className="whitespace-nowrap text-[11px] text-ink-400">{matches.length} of {options.length}</span>
          </label>
          <div ref={listRef} className="min-h-0 flex-1 overflow-y-auto p-1">
            {shown.length === 0 && <div className="px-2 py-6 text-center text-[12.5px] text-ink-400">No SKU matches "{q}"</div>}
            {shown.map((o, i) => (
              <button type="button" key={o.pepCode} data-i={i} onMouseEnter={() => setActive(i)} onClick={() => pick(o.pepCode)}
                className={`flex w-full items-start gap-2 rounded px-2 py-1.5 text-left transition-colors duration-100 ${i === active ? 'bg-alt' : ''}`}>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-mono text-[12px] text-ink-900"><Marked text={o.pepCode} q={terms} /></div>
                  {o.skuName && <div className="truncate text-[11.5px] text-ink-600"><Marked text={o.skuName} q={terms} /></div>}
                  {(o.channelSkuCode || o.mrp !== null) && (
                    <div className="truncate text-[11px] text-ink-400">
                      {o.channelSkuCode && <>Channel <span className="font-mono"><Marked text={o.channelSkuCode} q={terms} /></span></>}
                      {o.channelSkuCode && o.mrp !== null && ' · '}
                      {o.mrp !== null && <>MRP {o.mrp}</>}
                    </div>
                  )}
                </div>
                {o.pepCode === value && <Check className="mt-0.5 size-3.5 shrink-0 text-primary" />}
              </button>
            ))}
            {matches.length > SHOW_MAX && <div className="px-2 py-1.5 text-center text-[11px] text-ink-400">Showing {SHOW_MAX} of {matches.length}: type more to narrow it down</div>}
          </div>
          {value && (
            <div className="border-t border-line px-2 py-1.5 text-right">
              <button type="button" onClick={() => pick('')} className="rounded px-2 py-1 text-[12px] text-ink-600 hover:bg-alt">Clear mapping</button>
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  )
}
