import { readonly, ref } from 'vue'
import type { Router } from 'vue-router'

const target = ref<string | null>(null)
export const navigationRecoveryTarget = readonly(target)

function isPageLoadError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|Loading (?:CSS )?chunk .+ failed/i.test(message)
}

export function dismissNavigationRecovery() {
  target.value = null
}

export function reloadNavigationTarget() {
  if (!target.value) return
  if (!window.confirm('Reload to continue? Any unsaved changes on this page will be lost. Cancel to save your work first.')) return
  // A full navigation fetches the current build and preserves the requested tab.
  window.location.assign(target.value)
}

export function installNavigationRecovery(router: Router) {
  const removeErrorHandler = router.onError((error, to) => {
    if (isPageLoadError(error)) target.value = router.resolve(to).href
  })
  const removeNavigationHandler = router.afterEach((_to, _from, failure) => {
    if (!failure) dismissNavigationRecovery()
  })
  const onPreloadError = (event: Event) => {
    if (isPageLoadError((event as Event & { payload: unknown }).payload)) {
      target.value = window.location.href
    }
    // Let the error propagate so the router cancels navigation and keeps the
    // current page mounted. Its onError handler supplies the destination above.
  }
  window.addEventListener('vite:preloadError', onPreloadError)
  return () => {
    removeErrorHandler()
    removeNavigationHandler()
    window.removeEventListener('vite:preloadError', onPreloadError)
  }
}
