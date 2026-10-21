import { nextTick, onBeforeUnmount, type Ref } from 'vue'

/** Keep removal of the old sheet from collapsing the page during a character switch. */
export function useCharacterSwitchScroll(host: Ref<HTMLElement | null>) {
  let pending: { element: HTMLElement; minHeight: string; x: number; y: number } | null = null
  let generation = 0
  const followScroll = () => {
    if (pending) { pending.x = window.scrollX; pending.y = window.scrollY }
  }
  function begin() {
    const element = host.value
    if (!element) return
    generation++
    if (!pending) {
      pending = { element, minHeight: element.style.minHeight, x: window.scrollX, y: window.scrollY }
      window.addEventListener('scroll', followScroll, { passive: true })
    }
    // Set this before Vue removes the old content, including keyed room sheets.
    element.style.minHeight = `${element.getBoundingClientRect().height}px`
  }
  async function finish() {
    const run = generation
    await nextTick()
    if (run !== generation || !pending) return
    const saved = pending
    pending = null
    window.removeEventListener('scroll', followScroll)
    saved.element.style.minHeight = saved.minHeight
    // A shorter sheet may clamp at its end. Never animate the correction or
    // override scrolling the user deliberately did while the request was pending.
    if (saved.element.isConnected) window.scrollTo({ left: saved.x, top: saved.y, behavior: 'instant' })
  }
  onBeforeUnmount(() => {
    generation++
    window.removeEventListener('scroll', followScroll)
    if (pending) pending.element.style.minHeight = pending.minHeight
    pending = null
  })
  return { begin, finish }
}
