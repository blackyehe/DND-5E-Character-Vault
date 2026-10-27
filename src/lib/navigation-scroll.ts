/** Explicit navigation should reveal its heading only when it is off screen.
 * In-place updates, polling and ordinary selection never call this helper.
 */
export function revealNavigationTarget(element: HTMLElement | null | undefined, top = 88) {
  if (!element) return
  const bounds = element.getBoundingClientRect()
  if (bounds.top >= top && bounds.top <= window.innerHeight - 48) return
  window.scrollTo({ top: Math.max(0, window.scrollY + bounds.top - top), behavior: 'instant' })
}
