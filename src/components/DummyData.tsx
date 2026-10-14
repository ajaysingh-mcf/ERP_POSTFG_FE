import type { ReactNode } from 'react'
import { FlaskConical } from 'lucide-react'
import { SHOW_DUMMY_MARK } from '../constants/pages'

/** Dev only: the strip on top of a page (or a part of one) that still shows the design's sample data, not the API's. */
export function DummyDataStrip({ what = 'this page' }: { what?: string }) {
  return (
    <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-300 bg-amber-100 px-3 py-1.5 text-[12px] font-medium text-amber-800">
      <FlaskConical className="size-3.5" />
      Dummy data: {what} is not connected to the API yet (shown in dev only)
    </div>
  )
}

/** Dev only: tints a part of a live page that still shows sample data (same look as a whole dummy page). */
export function DummySection({ what, children }: { what: string; children: ReactNode }) {
  if (!SHOW_DUMMY_MARK) return <>{children}</>
  return (
    <div className="dummy-data -mx-3 rounded-[var(--radius-card)] bg-canvas p-3">
      <DummyDataStrip what={what} />
      {children}
    </div>
  )
}
