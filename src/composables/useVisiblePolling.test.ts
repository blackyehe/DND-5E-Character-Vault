import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRenderer, createSSRApp } from 'vue'
import { renderToString } from 'vue/server-renderer'
import { useVisiblePolling } from './useVisiblePolling'

const renderer = createRenderer<object, object>({
  patchProp() {}, insert() {}, remove() {}, createElement: () => ({}), createText: () => ({}),
  createComment: () => ({}), setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null,
})
class VisibilityDocument extends EventTarget { visibilityState = 'visible' }
let page: VisibilityDocument, host: EventTarget, stop: (() => void) | undefined
function mount(refresh: () => void, interval = 15000, options = {}) {
  const app = renderer.createApp({ setup() { useVisiblePolling(refresh, interval, options); return () => null } })
  app.mount({}); stop = () => app.unmount()
}
beforeEach(() => {
  vi.useFakeTimers(); page = new VisibilityDocument(); host = new EventTarget()
  vi.stubGlobal('document', page); vi.stubGlobal('window', host)
})
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); vi.unstubAllGlobals() })

describe('visible polling lifecycle', () => {
  it('preserves the first periodic tick without adding an immediate load', () => {
    const refresh = vi.fn(); mount(refresh)
    vi.advanceTimersByTime(14999); expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1); expect(refresh).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(15000); expect(refresh).toHaveBeenCalledTimes(2)
  })
  it('skips hidden ticks/signals and resumes immediately when visible', () => {
    const refresh = vi.fn(); mount(refresh)
    page.visibilityState = 'hidden'
    page.dispatchEvent(new Event('visibilitychange')); host.dispatchEvent(new Event('focus'))
    vi.advanceTimersByTime(30000); expect(refresh).not.toHaveBeenCalled()
    page.visibilityState = 'visible'; page.dispatchEvent(new Event('visibilitychange'))
    expect(refresh).toHaveBeenCalledTimes(1)
    host.dispatchEvent(new Event('focus')); expect(refresh).toHaveBeenCalledTimes(2)
  })
  it('preserves timer-only 3-second sheet polling without new focus/resume reads', () => {
    const refresh = vi.fn(); mount(refresh, 3000, { focus: false, visibility: false })
    host.dispatchEvent(new Event('focus')); page.dispatchEvent(new Event('visibilitychange'))
    vi.advanceTimersByTime(2999); expect(refresh).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1); expect(refresh).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(3000); expect(refresh).toHaveBeenCalledTimes(2)
  })
  it('preserves the notebook focus-only behavior', () => {
    const refresh = vi.fn(); mount(refresh, 15000, { visibility: false })
    page.dispatchEvent(new Event('visibilitychange')); expect(refresh).not.toHaveBeenCalled()
    host.dispatchEvent(new Event('focus')); expect(refresh).toHaveBeenCalledTimes(1)
  })
  it('removes every timer/listener and creates one fresh set when remounted', () => {
    const refresh = vi.fn(); mount(refresh)
    stop!(); stop = undefined
    expect(vi.getTimerCount()).toBe(0)
    host.dispatchEvent(new Event('focus')); page.dispatchEvent(new Event('visibilitychange')); vi.advanceTimersByTime(30000)
    expect(refresh).not.toHaveBeenCalled()
    mount(refresh); expect(vi.getTimerCount()).toBe(1)
    vi.advanceTimersByTime(15000); expect(refresh).toHaveBeenCalledTimes(1)
  })
  it('registers no browser work during server rendering', async () => {
    vi.unstubAllGlobals()
    const refresh = vi.fn()
    await renderToString(createSSRApp({ setup() { useVisiblePolling(refresh, 15000); return () => null } }))
    expect(refresh).not.toHaveBeenCalled(); expect(vi.getTimerCount()).toBe(0)
  })
})
