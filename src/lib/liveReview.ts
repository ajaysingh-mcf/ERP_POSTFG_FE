import { useEffect, useRef, useState } from 'react'
import { api, apiUrl } from '../api/client'
import { LIVE_EVENT, LIVE_POLL_MS, LIVE_SILENT_MS, LIVE_WATCHDOG_MS } from '../constants/poOverview'
import { REVIEW_LIVE } from '../constants/poReview'
import type { LiveMode } from './liveShipments'

/*
 * Live PO Review + Approvals (2026-10-15, user: "on sync just like PO Overview"). The server sends the review data's
 * `version` (in every ping and in a `review` event when it changes); when it moves, onChange() reloads the screen's
 * lists. Same self-healing as PO Overview: SSE first; an error or LIVE_SILENT_MS of silence -> poll
 * <base>/live-state every LIVE_POLL_MS until SSE speaks again; hidden tab = no polling, catch up when shown;
 * 401 -> reload (login). `base` = '/po-review' or '/approvals'.
 */
export function useLiveReview(base: string, onChange: () => void): LiveMode {
  const [mode, setMode] = useState<LiveMode>('connecting')
  const changed = useRef(onChange)
  changed.current = onChange

  useEffect(() => {
    let stopped = false
    let last: string | null = null
    let lastHeard = Date.now()
    let pollTimer: ReturnType<typeof setTimeout> | undefined
    // A new version (not the first one we hear) means someone changed something: reload.
    const seen = (v?: string) => {
      if (!v) return
      if (last !== null && v !== last) changed.current()
      last = v
    }

    const poll = async () => {
      if (stopped || document.hidden) return
      try {
        seen((await api<{ version: string }>(`${base}${REVIEW_LIVE.STATE}`)).version)
      } catch (e) {
        if ((e as { status?: number }).status === 401) window.location.reload()
      }
    }
    const startPolling = () => {
      if (stopped || pollTimer) return
      setMode('polling')
      const tick = async () => { await poll(); if (!stopped) pollTimer = setTimeout(tick, LIVE_POLL_MS) }
      void tick()
    }
    const stopPolling = () => { clearTimeout(pollTimer); pollTimer = undefined }

    const es = new EventSource(apiUrl(`${base}${REVIEW_LIVE.EVENTS}`), { withCredentials: true })
    const heard = (e: Event) => {
      lastHeard = Date.now()
      if (pollTimer) stopPolling()
      setMode('live')
      try { seen((JSON.parse((e as MessageEvent).data) as { version?: string }).version) } catch { /* ignore */ }
    }
    es.addEventListener(LIVE_EVENT.PING, heard)
    es.addEventListener(REVIEW_LIVE.EVENT_CHANGE, heard)
    es.onerror = () => startPolling() // the browser keeps retrying SSE; its first message stops the polling

    const watchdog = setInterval(() => { if (Date.now() - lastHeard > LIVE_SILENT_MS) startPolling() }, LIVE_WATCHDOG_MS)
    const onVisible = () => { if (!document.hidden && pollTimer) void poll() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      stopped = true
      es.close()
      stopPolling()
      clearInterval(watchdog)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [base])

  return mode
}
