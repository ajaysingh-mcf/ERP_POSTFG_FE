# Post FG ERP — restructure into 3 modules + Approvals

## Context
The current app has 4 flat modules (Orders, Inventory, Analytics, Masters). The user wants a hierarchical IA that matches their ops workflow: expandable sidebar groups with sub-items (screenshot 1), a standard toolbar on every section (search + Filters toggle + CSV / Excel / Upload CSV + primary action — screenshots 2–3), and an expandable filter panel with the exact filter sets from the dark screenshots (4–5). The existing light theme and design tokens (Source Serif 4 / Inter / JetBrains Mono, indigo #4F46E5) stay.

**Assumptions (correct me if wrong):**
- "Filters in the image in dark mode" = reproduce *those filter fields*, rendered in our existing light theme (no dark mode).
- Sidebar uses the screenshot-1 pattern: group header with chevron, indented sub-item list; collapses to icon-only rail.
- Approvals is a top-level nav item (queue of pending changes: appointment-date changes, channel-priority edits, manual-upload POs, qty updates) with Approve/Reject in the right drawer.
- Shipment Status table renders all ~80 listed columns, horizontally scrolling with sticky UID/PO Number columns.

## Navigation
```
Masters ▸ (existing 8 masters: SKUs, Channels, Facilities, …)
B2B/B2C Operations ▸ PO Overview · PO Processing & Review · PO Working · Analytics
Demand Planning ▸ Inventory Calculation · DRR & Aging · Analytics
Approvals
```
State: `{ module, section }` in `App.tsx` (no router needed); subtabs inside each section via existing `SubTabs`.

## Shared building blocks (`src/components/ui.tsx`, extend not replace)
- `SectionToolbar` — search input, Filters toggle (with active-count badge), CSV, Excel (download .xls-compatible CSV), Upload CSV (reuses `BulkUpload`), optional primary action. Reuse `downloadCsv`.
- `FilterPanel` — card with 6-col responsive grid, Clear / Apply; field types: `date`, `multi` (multi-select chip dropdown with ×), `text`. Driven by a config array so each section declares its filters.
- `DataGrid` — sticky header, sticky first columns, horizontal scroll, pagination (1, 2, …, Next), record count, row click → `Drawer`.
- `NavGroup` sidebar component.

## Data (`src/lib/data.ts`, extend)
- `SHIPMENTS` generator: full Shipment Status record type with all columns from the brief (seeded from the example row: UID 135290, MUM_WAREHOUSE2, Zepto, Hyderabad, 3100495853…), ~60 rows.
- `poFormatRows()`: line-level rows (Shipment UID … Status) derived from existing `POS`/`POLine`.
- `PROCESSED_POS` (source API/Webhook, processedAt, originalFileUrl), `IN_REVIEW_POS` (labelled parse errors per field), `CHANNEL_PRIORITY` (editable), `LOGISTICS` (partner, rate/kg, docket), `APPROVALS`, DRR series (3/7/30-day + 30-day history per SKU).
- Reuse `computeInventory`, `overallInventory`, `agingBand`, `criticality`, `fillRate`.

## Pages (new `src/pages/ops/*`, `src/pages/dp/*`; existing pages reused/moved)
1. **PO Overview** — subtabs *Shipment Status* (PO-level, filters: Not-assigned dates, PO/Working/Dispatch/Current Appt from–to, Brand, Channel, Facility, Location, Status Planning/Warehouse/Logistics, Final Status, Transporter, Docket No; Bulk Edit) and *PO Format Data* (line-level, filters: PO/Working date ranges, Brand, Channel, Facility, Location, SKU Code, 3 statuses, Final Status; Bulk SKU Update). Action column = "⋯" row menu (View, Edit, Update qty).
2. **PO Processing & Review** — *Processed* (default last 3 days, date-range filter, source badge API/Webhook, link to original file); *In Review* (error label chips; click → drawer showing parsed fields with highlighted errors, editable, "Mark processed" moves row to Processed); *Manual Upload* (drop zones for CSV + PDF, channel/brand selectors, upload queue with status → goes to In Review / Approvals).
3. **PO Working** — top strip "SKUs short for open POs" (required vs available, shortfall); active POs (not Delivered) grid with criticality badge from appointment date × channel priority; inline remarks, appointment date edit (reason required, reuses existing pattern), logistics drawer section (partner, rate/kg, docket, pickup date); *Channel Priority* editor (card with editable rank per channel).
4. **Ops Analytics** — existing `Analytics.tsx` charts (fill rate, PO→delivery).
5. **Inventory Calculation** — subtabs Overview (existing Inventory view), By Channel, By SKU, SKU × Facility pivot, In-transit.
6. **DRR & Aging** — *Current* (aging, DRR 3/7/30, deviation % coloured), *Critical SKUs* (aging < 45 days, danger tone), *Historical Trend* (recharts line chart + selectable SKU).
7. **DP Analytics** — inventory KPIs + cover/aging distribution bars.
8. **Approvals** — subtabs Pending / Approved / Rejected, type filter, drawer with diff (old → new) + approve/reject with comment.
9. **Masters** — existing `Masters.tsx`, subtabs exposed as sidebar sub-items.

Every section gets `SectionToolbar` + `FilterPanel`.

## Critical files
`src/App.tsx` (nav groups + routing), `src/components/ui.tsx`, `src/lib/data.ts`, `src/pages/Orders.tsx` (split into ops pages; reuse drawer/edit logic), `src/pages/Inventory.tsx`, `src/pages/Analytics.tsx`, `src/pages/Masters.tsx`, new files under `src/pages/ops/`, `src/pages/dp/`, `src/pages/Approvals.tsx`.

## Verification
`pnpm tsc --noEmit` and `pnpm build`; click through each nav item/subtab in preview, toggle filters, open drawers, move an In-Review PO to Processed.
