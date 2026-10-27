import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, createRenderer, nextTick, ref } from 'vue'
import { emptyCharacter } from '../../shared/character'
import { partyMemberSnapshot } from '../../shared/party-dashboard'
import { api, ApiError } from '../lib/api'
import { usePartyDashboard } from './usePartyDashboard'

vi.mock('../lib/api', () => ({
  api: { get: vi.fn(), patch: vi.fn() },
  ApiError: class extends Error { status: number; constructor(status: number, message: string) { super(message); this.status = status } },
}))
const renderer = createRenderer<object, object>({
  patchProp() {}, insert() {}, remove() {}, createElement: () => ({}), createText: () => ({}),
  createComment: () => ({}), setText() {}, setElementText() {}, parentNode: () => null, nextSibling: () => null,
})
const member = (id = 'hero', hp = 10) => {
  const c = { ...emptyCharacter(), _id: id, updatedAt: '2026-10-27T00:00:00Z' }
  c.combat.hpCurrent = hp; c.combat.hpMax = 20
  return partyMemberSnapshot(c)
}
class VisibilityDocument extends EventTarget { visibilityState = 'visible' }
let page: VisibilityDocument, host: EventTarget, stop: (() => void) | undefined
const settle = async () => { await nextTick(); await Promise.resolve(); await nextTick() }
function mount() {
  const room = ref('room'), ids = ref(['hero']), active = ref(true), accessLost = vi.fn()
  let dashboard!: ReturnType<typeof usePartyDashboard>
  const app = renderer.createApp({ setup() {
    dashboard = usePartyDashboard(computed(() => room.value), computed(() => ids.value), () => active.value, accessLost)
    return () => null
  } })
  app.mount({}); stop = () => app.unmount()
  return { dashboard, room, ids, active, accessLost }
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(0); vi.clearAllMocks()
  page = new VisibilityDocument(); host = new EventTarget()
  vi.stubGlobal('document', page); vi.stubGlobal('window', host)
  vi.mocked(api.get).mockResolvedValue({ members: [member()] })
})
afterEach(() => { stop?.(); stop = undefined; vi.useRealTimers(); vi.unstubAllGlobals() })

describe('party polling and response ownership', () => {
  it('keeps the 15-second cadence, visible resume, inactive guards and unmount cleanup', async () => {
    const requests: number[] = []
    vi.mocked(api.get).mockImplementation(async () => { requests.push(Date.now()); return { members: [member()] } })
    const { active } = mount(); await settle()
    await vi.advanceTimersByTimeAsync(15000)
    page.visibilityState = 'hidden'; page.dispatchEvent(new Event('visibilitychange')); host.dispatchEvent(new Event('focus'))
    await vi.advanceTimersByTimeAsync(30000)
    page.visibilityState = 'visible'; page.dispatchEvent(new Event('visibilitychange')); host.dispatchEvent(new Event('focus')); await settle()
    await vi.advanceTimersByTimeAsync(15000)
    expect(requests).toEqual([0, 15000, 45000, 60000])
    active.value = false; await settle(); await vi.advanceTimersByTimeAsync(15000)
    expect(requests).toHaveLength(4)
    stop!(); stop = undefined
    page.dispatchEvent(new Event('visibilitychange')); host.dispatchEvent(new Event('focus')); await vi.advanceTimersByTimeAsync(30000)
    expect(requests).toHaveLength(4)
    console.log('POLLING_TIMELINE ' + JSON.stringify({ virtualTimelineMs: 60000, requestTimesMs: requests, hiddenRequests: 0, requestsAfterInactiveOrUnmount: 0 }))
  })
  it('does not restart an in-flight read on simultaneous focus and visibility signals', async () => {
    const { dashboard } = mount(); await settle()
    let finish!: (value: unknown) => void
    vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await vi.advanceTimersByTimeAsync(15000)
    host.dispatchEvent(new Event('focus')); page.dispatchEvent(new Event('visibilitychange')); await settle()
    expect(api.get).toHaveBeenCalledTimes(2)
    finish({ members: [member('hero', 7)] }); await settle()
    expect(dashboard.members.value.hero?.hp.current).toBe(7)
  })
  it('preserves a save and ignores the superseded background response', async () => {
    const { dashboard } = mount(); await settle()
    let finishRead!: (value: unknown) => void, finishSave!: (value: unknown) => void
    vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { finishRead = resolve }))
    await vi.advanceTimersByTimeAsync(15000)
    vi.mocked(api.patch).mockImplementationOnce(() => new Promise(resolve => { finishSave = resolve }))
    const saving = dashboard.save('hero', { expectedUpdatedAt: '2026-10-27T00:00:00Z', combat: { hpCurrent: 8 } })
    await vi.advanceTimersByTimeAsync(15000)
    host.dispatchEvent(new Event('focus')); page.dispatchEvent(new Event('visibilitychange'))
    expect(api.get).toHaveBeenCalledTimes(2)
    finishRead({ members: [member('hero', 1)] }); await settle()
    expect(dashboard.members.value.hero?.hp.current).toBe(10)
    const saved = { ...emptyCharacter(), _id: 'hero', updatedAt: '2026-10-27T00:00:01Z' }
    saved.combat.hpCurrent = 8; saved.combat.hpMax = 20
    finishSave(saved); await saving
    expect(dashboard.members.value.hero?.hp.current).toBe(8)
  })
  it('clears private snapshots when polling reports revoked access', async () => {
    const { dashboard, accessLost } = mount(); await settle()
    vi.mocked(api.get).mockRejectedValueOnce(new ApiError(403, 'Access ended'))
    await vi.advanceTimersByTimeAsync(15000)
    expect(dashboard.members.value).toEqual({}); expect(dashboard.stale.value).toBe(true)
    expect(accessLost).toHaveBeenCalledOnce()
  })
  it('ignores a response from the previous room after switching scope', async () => {
    const { dashboard, room } = mount(); await settle()
    let finish!: (value: unknown) => void
    vi.mocked(api.get).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    await vi.advanceTimersByTimeAsync(15000)
    vi.mocked(api.get).mockResolvedValue({ members: [member('hero', 9)] })
    room.value = 'other-room'; await settle()
    finish({ members: [member('hero', 1)] }); await settle()
    expect(dashboard.members.value.hero?.hp.current).toBe(9)
    expect(vi.mocked(api.get).mock.lastCall?.[0]).toContain('/api/rooms/other-room/party')
  })
})
