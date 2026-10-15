import type { LiveMode } from '../lib/liveShipments'

/** Live updates state: live (SSE), polling every 60 s (fallback, switches back by itself), connecting. */
export function LiveDot({ mode }: { mode: LiveMode }) {
  const look = mode === 'live' ? ['bg-ok', 'Live'] : mode === 'polling' ? ['bg-warn', 'Updating every 60 s'] : ['bg-ink-400', 'Connecting…']
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-ink-600">
      <span className={`relative flex size-2`}>
        {mode === 'live' && <span className="absolute inline-flex size-full animate-ping rounded-full bg-ok opacity-50" />}
        <span className={`relative inline-flex size-2 rounded-full ${look[0]}`} />
      </span>
      {look[1]}
    </span>
  )
}
