import type { ObjectDirective } from 'vue'

const running = new Map<HTMLElement, Animation>()
const easing = 'cubic-bezier(.2,.7,.2,1)'
const expressiveEasing = 'cubic-bezier(.16,1,.3,1)'

export function cancelSiteMotion() {
  for (const animation of running.values()) animation.cancel()
  running.clear()
}

function cancel(element: HTMLElement) {
  running.get(element)?.cancel()
  running.delete(element)
}

export function cancelMotionWithin(root: HTMLElement | null) {
  if (!root) return
  for (const [element] of running) if (root === element || root.contains(element)) cancel(element)
}

function enabled(element: HTMLElement) {
  return element.isConnected && typeof element.animate === 'function' &&
    element.closest('.site-shell')?.getAttribute('data-motion') === 'balanced' &&
    !window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function animate(element: HTMLElement, frames: Keyframe[], duration: number, delay = 0, curve = easing) {
  cancel(element)
  if (!enabled(element)) return
  try {
    const animation = element.animate(frames, { duration, delay, easing: curve, fill: 'backwards' })
    running.set(element, animation)
    const release = () => { if (running.get(element) === animation) running.delete(element) }
    animation.onfinish = release; animation.oncancel = release
  } catch { /* Feedback must never interrupt navigation or saving. */ }
}

function feedback(duration: number, distance: number): ObjectDirective<HTMLElement, unknown> {
  return {
    updated(element, { value, oldValue }) {
      if (Object.is(value, oldValue)) return
      cancel(element)
      // Vue has already written the new value. Motion never schedules or delays a save.
      animate(element, [{ opacity: .65, transform: `translateY(${distance}px)` }, { opacity: 1, transform: 'translateY(0)' }], duration)
    },
    beforeUnmount: cancel,
  }
}

// No mounted animation: opening a sheet or receiving its initial data stays quiet.
export const vMotionCounter = feedback(160, 3)
export const vMotionPanel = feedback(190, 4)

// Explicit user switches trigger this only after the fresh sheet is available.
export const vMotionCharacter: ObjectDirective<HTMLElement, number> = {
  updated(element, { value, oldValue }) {
    if (value === oldValue) return
    cancelMotionWithin(element)
    if (!value || !enabled(element)) return
    animate(element, [{ opacity: .65, transform: 'translateX(20px) scale(.988)' }, { opacity: 1, transform: 'translateX(0) scale(1)' }], 390, 0, expressiveEasing)
    const panels = element.querySelectorAll<HTMLElement>('.sheet-tab-content .sheet-panel, .sheet-rail-content>.sheet-panel')
    Array.from(panels).slice(0, 4).forEach((panel, index) => animate(panel, [{ opacity: .7, transform: 'translateY(12px)' }, { opacity: 1, transform: 'translateY(0)' }], 330, Math.min(index, 2) * 45, expressiveEasing))
  },
  beforeUnmount: cancelMotionWithin,
}
