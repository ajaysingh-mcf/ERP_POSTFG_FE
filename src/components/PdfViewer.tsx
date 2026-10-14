import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp, Maximize2, Minus, Plus } from 'lucide-react'
import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { PDF_VIEWER } from '../constants/poReview'

GlobalWorkerOptions.workerSrc = workerUrl

/*
 * One PDF page at a time (pdf.js), in the dark Figma viewer frame:
 *   toolbar  title · ↑ ↓ page n / N · − zoom % + fit · actions (open in new tab, download)
 *   body     the page, fit to the box's width; zoomed in, drag it (or scroll) to move around.
 * Keys when the viewer has focus: ↑ / PageUp previous page, ↓ / PageDown next, + / − zoom, 0 fit to width.
 */

type Props = {
  /** Loads the file's bytes (aborted when the viewer closes). */
  load: (signal: AbortSignal) => Promise<ArrayBuffer>
  title: ReactNode
  actions?: ReactNode
  loadingText: string
  failedText: string
}

const btn = 'rounded p-1 hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent'

export function PdfViewer({ load, title, actions, loadingText, failedText }: Props) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [failed, setFailed] = useState(false)
  const [pageNo, setPageNo] = useState(1)
  const [pageInput, setPageInput] = useState('1')
  const [zoom, setZoom] = useState<number>(PDF_VIEWER.FIT)
  const [boxWidth, setBoxWidth] = useState(0)
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Where the view was centred (as a fraction of the page) before a zoom, so the same spot stays in view after it.
  const anchor = useRef<{ fx: number; fy: number } | null>(null)
  const drag = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  const [dragging, setDragging] = useState(false)

  // Load the file once.
  useEffect(() => {
    const ctrl = new AbortController()
    let loaded: PDFDocumentProxy | null = null
    setDoc(null)
    setFailed(false)
    load(ctrl.signal)
      .then((bytes) => getDocument({ data: new Uint8Array(bytes) }).promise)
      .then((d) => {
        if (ctrl.signal.aborted) return void d.loadingTask.destroy()
        loaded = d
        setDoc(d)
        setPageNo(1)
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setFailed(true)
      })
    return () => {
      ctrl.abort()
      void loaded?.loadingTask.destroy()
    }
  }, [load])

  // Fit to width follows the box's width.
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const ro = new ResizeObserver(() => setBoxWidth(box.clientWidth))
    ro.observe(box)
    return () => ro.disconnect()
  }, [doc])

  // Draw the page (off screen first, so the old page stays until the new one is ready).
  useEffect(() => {
    if (!doc || !boxWidth) return
    let task: RenderTask | null = null
    let cancelled = false
    void (async () => {
      const page = await doc.getPage(pageNo)
      if (cancelled) return
      const natural = page.getViewport({ scale: 1 })
      const scale = (Math.max(boxWidth - PDF_VIEWER.PADDING * 2, 100) / natural.width) * zoom
      const dpr = window.devicePixelRatio || 1
      const viewport = page.getViewport({ scale: scale * dpr })
      const off = document.createElement('canvas')
      off.width = Math.floor(viewport.width)
      off.height = Math.floor(viewport.height)
      task = page.render({ canvas: off, viewport })
      try {
        await task.promise
      } catch {
        return // cancelled by a newer page / zoom
      }
      const canvas = canvasRef.current
      const box = boxRef.current
      if (cancelled || !canvas || !box) return
      canvas.width = off.width
      canvas.height = off.height
      canvas.style.width = `${viewport.width / dpr}px`
      canvas.style.height = `${viewport.height / dpr}px`
      canvas.getContext('2d')?.drawImage(off, 0, 0)
      if (anchor.current) {
        box.scrollLeft = anchor.current.fx * box.scrollWidth - box.clientWidth / 2
        box.scrollTop = anchor.current.fy * box.scrollHeight - box.clientHeight / 2
        anchor.current = null
      }
    })()
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [doc, pageNo, zoom, boxWidth])

  const pages = doc?.numPages ?? 0
  const goTo = useCallback(
    (n: number) => {
      if (!pages) return
      const next = Math.min(Math.max(n, 1), pages)
      setPageNo(next)
      setPageInput(String(next))
      boxRef.current?.scrollTo({ top: 0 })
    },
    [pages],
  )
  const zoomTo = (z: number) => {
    const box = boxRef.current
    if (box && box.scrollWidth && box.scrollHeight) {
      anchor.current = {
        fx: (box.scrollLeft + box.clientWidth / 2) / box.scrollWidth,
        fy: (box.scrollTop + box.clientHeight / 2) / box.scrollHeight,
      }
    }
    setZoom(z)
  }
  const steps = PDF_VIEWER.ZOOM_STEPS
  const zoomIn = () => zoomTo(steps.find((s) => s > zoom + 1e-6) ?? zoom)
  const zoomOut = () => zoomTo([...steps].reverse().find((s) => s < zoom - 1e-6) ?? zoom)

  const onKey = (e: React.KeyboardEvent) => {
    if ((e.target as HTMLElement).tagName === 'INPUT') return
    const act: Record<string, () => void> = {
      ArrowUp: () => goTo(pageNo - 1),
      PageUp: () => goTo(pageNo - 1),
      ArrowDown: () => goTo(pageNo + 1),
      PageDown: () => goTo(pageNo + 1),
      '+': zoomIn,
      '=': zoomIn,
      '-': zoomOut,
      '0': () => zoomTo(PDF_VIEWER.FIT),
    }
    if (act[e.key]) {
      e.preventDefault()
      act[e.key]()
    }
  }

  // Drag to move around a page that is bigger than the box.
  const canDrag = () => {
    const box = boxRef.current
    return !!box && (box.scrollWidth > box.clientWidth || box.scrollHeight > box.clientHeight)
  }
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0 || !canDrag()) return
    const box = e.currentTarget
    drag.current = { x: e.clientX, y: e.clientY, left: box.scrollLeft, top: box.scrollTop }
    box.setPointerCapture(e.pointerId)
    setDragging(true)
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d) return
    e.currentTarget.scrollLeft = d.left - (e.clientX - d.x)
    e.currentTarget.scrollTop = d.top - (e.clientY - d.y)
  }
  const endDrag = () => {
    drag.current = null
    setDragging(false)
  }

  return (
    <div tabIndex={0} onKeyDown={onKey} className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[var(--radius-card)] bg-[#323639] outline-none focus-visible:ring-2 focus-visible:ring-primary">
      <div className="flex items-center gap-3 px-4 py-2 text-[13px] text-white/90">
        <div className="flex min-w-0 flex-1 items-center gap-2">{title}</div>
        {doc && (
          <>
            <div className="flex shrink-0 items-center gap-1">
              <button onClick={() => goTo(pageNo - 1)} disabled={pageNo <= 1} title="Previous page (↑)" className={btn}><ChevronUp className="size-4" /></button>
              <button onClick={() => goTo(pageNo + 1)} disabled={pageNo >= pages} title="Next page (↓)" className={btn}><ChevronDown className="size-4" /></button>
              <input
                value={pageInput}
                onChange={(e) => setPageInput(e.target.value.replace(/\D/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && goTo(Number(pageInput) || pageNo)}
                onBlur={() => setPageInput(String(pageNo))}
                aria-label="Page"
                className="tnum w-8 rounded bg-black/30 px-1 py-0.5 text-center text-[12px] text-white outline-none focus:ring-1 focus:ring-white/40"
              />
              <span className="tnum text-[12px] text-white/70">/ {pages}</span>
            </div>
            <span className="h-4 w-px shrink-0 bg-white/20" />
            <div className="flex shrink-0 items-center gap-1">
              <button onClick={zoomOut} disabled={zoom <= steps[0]} title="Zoom out (−)" className={btn}><Minus className="size-4" /></button>
              <span className="tnum w-10 text-center text-[12px] text-white/80">{Math.round(zoom * 100)}%</span>
              <button onClick={zoomIn} disabled={zoom >= steps[steps.length - 1]} title="Zoom in (+)" className={btn}><Plus className="size-4" /></button>
              <button onClick={() => zoomTo(PDF_VIEWER.FIT)} disabled={zoom === PDF_VIEWER.FIT} title="Fit to width (0)" className={btn}><Maximize2 className="size-3.5" /></button>
            </div>
          </>
        )}
        {actions && <span className="flex shrink-0 items-center gap-3 border-l border-white/20 pl-3 opacity-80">{actions}</span>}
      </div>
      <div
        ref={boxRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className={`min-h-0 flex-1 overflow-auto bg-[#525659] select-none ${dragging ? 'cursor-grabbing' : zoom > PDF_VIEWER.FIT ? 'cursor-grab' : ''}`}
      >
        {failed ? (
          <div className="p-6 text-center text-[13px] text-white/80">{failedText}</div>
        ) : !doc ? (
          <div className="p-6 text-center text-[13px] text-white/80">{loadingText}</div>
        ) : (
          <div className="flex min-h-full w-max min-w-full items-start justify-center" style={{ padding: PDF_VIEWER.PADDING }}>
            <canvas ref={canvasRef} className="bg-white shadow-xl" />
          </div>
        )}
      </div>
    </div>
  )
}
