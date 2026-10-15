/*
 * Number boxes never change by themselves (user, 2026-10-15): the browser adds / subtracts 1 when the mouse wheel or
 * touchpad scrolls over a focused number box, or on the ↑ / ↓ keys. Both are switched off for every number box in the
 * app; only what is typed counts. The wheel still scrolls the page as normal. (The spin arrows are hidden in index.css.)
 */
const isNumberBox = (el: EventTarget | null): el is HTMLInputElement => el instanceof HTMLInputElement && el.type === 'number'

export function blockNumberStepping(): void {
  // Wheel over the focused box: take the focus away first, so the browser scrolls the page instead of changing the value.
  document.addEventListener('wheel', (e) => {
    if (isNumberBox(e.target) && document.activeElement === e.target) e.target.blur()
  }, { passive: true, capture: true })
  document.addEventListener('keydown', (e) => {
    if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && isNumberBox(e.target)) e.preventDefault()
  }, { capture: true })
}
