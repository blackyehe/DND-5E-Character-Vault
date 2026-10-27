import { onUnmounted, ref, watch, type ComputedRef } from 'vue'
import type { Character } from '../../shared/character'
import type { PlayUpdate } from '../../shared/rooms'
import { partyMemberSnapshot, type PartyMemberSnapshot } from '../../shared/party-dashboard'
import { api, ApiError } from '../lib/api'

export function usePartyDashboard(roomId: ComputedRef<string>, ids: ComputedRef<string[]>, active: () => boolean, accessLost: () => void) {
  const members = ref<Record<string, PartyMemberSnapshot>>({})
  const loading = ref(false), saving = ref(''), error = ref(''), notice = ref(''), stale = ref(true), updated = ref('')
  let epoch = 0, disposed = false, controller: AbortController | undefined

  async function refresh() {
    if (disposed || !active() || saving.value) return
    controller?.abort()
    controller = new AbortController()
    const signal = controller.signal, run = ++epoch, wanted = [...ids.value]
    loading.value = true
    try {
      const next: Record<string, PartyMemberSnapshot> = {}
      for (let offset = 0; offset < wanted.length; offset += 40) {
        const data = await api.get<{ members: PartyMemberSnapshot[] }>(`/api/rooms/${roomId.value}/party?characters=${wanted.slice(offset, offset + 40).join(',')}`, { signal })
        for (const member of data.members) next[member.id] = member
      }
      if (run !== epoch || disposed) return
      members.value = next; stale.value = false; error.value = ''; updated.value = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch (e) {
      if (run !== epoch || disposed || signal.aborted) return
      stale.value = true
      error.value = e instanceof Error ? e.message : 'Party updates could not load. Try Refresh party.'
      if (e instanceof ApiError && [401, 403, 404].includes(e.status)) { members.value = {}; accessLost() }
    } finally { if (run === epoch && !disposed) loading.value = false }
  }

  async function save(id: string, update: PlayUpdate) {
    if (saving.value || stale.value || !members.value[id] || disposed) return
    controller?.abort(); epoch++
    loading.value = false; saving.value = id; error.value = ''; notice.value = ''
    const scope = roomId.value
    let reconcile = false, conflict = false
    try {
      const character = await api.patch<Character>(`/api/rooms/${scope}/characters/${id}/play`, update)
      if (disposed || scope !== roomId.value) return
      members.value = { ...members.value, [id]: partyMemberSnapshot(character) }
      notice.value = 'Changes saved.'
    } catch (e) {
      if (disposed || scope !== roomId.value) return
      stale.value = true; reconcile = true
      conflict = e instanceof ApiError && e.status === 409
      error.value = e instanceof Error ? e.message : 'Could not save this action.'
      if (e instanceof ApiError && [401, 403, 404].includes(e.status)) { members.value = {}; accessLost() }
    } finally {
      saving.value = ''
      if (reconcile && !disposed && scope === roomId.value) {
        await refresh()
        notice.value = stale.value ? 'The save could not be confirmed. Refresh party before trying again.'
          : conflict ? 'The sheet changed elsewhere. Latest values reloaded; review them before repeating the action.'
          : 'The save could not be confirmed. Review the refreshed values before trying again.'
      }
    }
  }

  watch([() => roomId.value, () => ids.value.join(',')], () => {
    controller?.abort(); epoch++; loading.value = false; stale.value = true
    members.value = Object.fromEntries(Object.entries(members.value).filter(([id]) => ids.value.includes(id)))
    void refresh()
  }, { immediate: true })
  watch(active, value => { if (value) void refresh() })
  const refreshVisible = () => { if (document.visibilityState === 'visible' && !loading.value) void refresh() }
  const timer = setInterval(refreshVisible, 15000)
  window.addEventListener('focus', refreshVisible)
  document.addEventListener('visibilitychange', refreshVisible)
  onUnmounted(() => { disposed = true; epoch++; controller?.abort(); clearInterval(timer); window.removeEventListener('focus', refreshVisible); document.removeEventListener('visibilitychange', refreshVisible) })
  return { members, loading, saving, error, notice, stale, updated, refresh, save }
}
