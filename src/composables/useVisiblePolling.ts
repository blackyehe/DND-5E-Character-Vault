import { onMounted, onUnmounted } from 'vue'

/** Own only the timer/listeners. Each caller keeps its refresh, draft, save,
 * in-flight request and stale-response rules, including any explicit refresh. */
export function useVisiblePolling(refresh: () => void, intervalMs: number, options: { focus?: boolean; visibility?: boolean } = {}) {
  let timer: ReturnType<typeof setInterval> | undefined
  const focus = options.focus !== false, visibility = options.visibility !== false
  const visibleRefresh = () => { if (document.visibilityState === 'visible') refresh() }
  onMounted(() => {
    timer = setInterval(visibleRefresh, intervalMs)
    if (focus) window.addEventListener('focus', visibleRefresh)
    if (visibility) document.addEventListener('visibilitychange', visibleRefresh)
  })
  onUnmounted(() => {
    clearInterval(timer)
    if (focus) window.removeEventListener('focus', visibleRefresh)
    if (visibility) document.removeEventListener('visibilitychange', visibleRefresh)
  })
}
