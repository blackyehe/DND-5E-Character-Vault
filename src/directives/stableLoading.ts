import type { ObjectDirective } from 'vue'

type Reservation = { minimum: string; priority: string }
const reservations = new WeakMap<HTMLElement, Reservation>()

function reserve(element: HTMLElement) {
  if (reservations.has(element)) return
  const height = element.getBoundingClientRect().height
  if (!height) return
  reservations.set(element, {
    minimum: element.style.getPropertyValue('min-height'),
    priority: element.style.getPropertyPriority('min-height'),
  })
  // Read before Vue replaces the loaded content with its pending/error state.
  const style = getComputedStyle(element)
  const inset = style.boxSizing === 'border-box' ? 0 :
    [style.paddingTop, style.paddingBottom, style.borderTopWidth, style.borderBottomWidth]
      .reduce((total, value) => total + (parseFloat(value) || 0), 0)
  element.style.setProperty('min-height', `${Math.max(0, height - inset)}px`)
}

function release(element: HTMLElement) {
  const previous = reservations.get(element)
  if (!previous) return
  if (previous.minimum) element.style.setProperty('min-height', previous.minimum, previous.priority)
  else element.style.removeProperty('min-height')
  reservations.delete(element)
}

/** Hold the existing footprint during a request, including retries and failures.
 * Bounded readers also reserve their normal frame in CSS, even on first load.
 * No scrolling, retained private content, timers, or lasting height overrides.
 */
export const vStableLoading: ObjectDirective<HTMLElement, boolean> = {
  mounted(element, { value }) { if (value) reserve(element) },
  beforeUpdate(element, { value }) { if (value) reserve(element) },
  updated(element, { value }) { if (!value) release(element) },
  beforeUnmount: release,
}
