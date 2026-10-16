import { useState } from 'react'
import type { ComponentType } from 'react'
import { Check, ExternalLink, Mail } from 'lucide-react'
import { apiUrl } from '../../api/client'
import { copyText } from '../../lib/clipboard'
import { COPIED_MS } from '../../constants/ui'
import { PO_FILE_PATH } from '../../constants/poReview'

/*
 * Cells of the PO Processing & Review lists (2026-10-16, user):
 *   SourceCell: API / Email / Manual with its icon; a click copies the PO's subject (the email subject; for an API PO the
 *               channel's own name, e.g. Amazon's "FBA STA (28/09/2026 08:03)-DEL5"; else the PO number). Hover shows it.
 *   FileCell:   a blue "View" only (user: no file name; the name shows on hover) that opens it in a new tab (PDF, sheet, the API's JSON ...),
 *               streamed from S3 by GET /po-review/:uploadId/file with the person's sign-in.
 * Both are buttons / links, so the grid's own click-to-copy leaves them alone.
 */

export function SourceCell({ source, subject, fallback, icon: Icon = Mail }: {
  source: string; subject: string | null; fallback: string; icon?: ComponentType<{ className?: string }>
}) {
  const [copied, setCopied] = useState(false)
  const text = subject?.trim() || fallback
  const copy = () => {
    if (!text) return
    void copyText(text).then((ok) => {
      if (!ok) return
      setCopied(true)
      setTimeout(() => setCopied(false), COPIED_MS)
    })
  }
  return (
    <button type="button" onClick={copy} title={text ? `Click to copy: ${text}` : undefined}
      className={`pf-press inline-flex items-center gap-1.5 rounded px-1.5 py-0.5 text-[12px] transition-colors duration-150 hover:bg-alt ${copied ? 'text-ok' : 'text-ink-600 hover:text-ink-900'}`}>
      {copied ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
      {copied ? 'Subject copied' : source}
    </button>
  )
}

export function FileCell({ uploadId, name }: { uploadId: string; name: string }) {
  return (
    <a href={apiUrl(PO_FILE_PATH(uploadId))} target="_blank" rel="noreferrer" title={`Open ${name} in a new tab`}
      className="inline-flex items-center gap-1 text-[12px] font-semibold text-primary hover:underline">
      <ExternalLink className="size-3.5" />View
    </a>
  )
}
