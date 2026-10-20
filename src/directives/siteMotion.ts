import type { ObjectDirective } from 'vue'

const running = new Map<HTMLElement, Animation>()
const easing = 'cubic-bezier(.2,.7,.2,1)'

export function cancelSiteMotion() {
  for (const animation of running.values()) animation.cancel()
  running.clear()
}

function cancel(element: HTMLElement) {
  running.get(element)?.cancel()
  running.delete(element)
}

function feedback(duration: number, distance: number): ObjectDirective<HTMLElement, unknown> {
  return {
    updated(element, { value, oldValue }) {
      if (Object.is(value, oldValue)) return
      cancel(element)
      if (!element.isConnected || !element.animate ||
          element.closest('.site-shell')?.getAttribute('data-motion') !== 'balanced' ||
          window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      // Vue has already written the new value. Motion never schedules or delays a save.
      try {
        const animation = element.animate([
          { opacity: .65, transform: `translateY(${distance}px)` },
          { opacity: 1, transform: 'translateY(0)' },
        ], { duration, easing })
        running.set(element, animation)
        const release = () => { if (running.get(element) === animation) running.delete(element) }
        animation.onfinish = release
        animation.oncancel = release
      } catch { /* Visual enhancement must never interrupt a sheet update. */ }
    },
    beforeUnmount: cancel,
  }
}

// No mounted animation: opening a sheet or receiving its initial data stays quiet.
export const vMotionCounter = feedback(160, 3)
export const vMotionPanel = feedback(190, 4)
