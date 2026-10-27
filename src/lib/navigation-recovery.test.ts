import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'
import { dismissNavigationRecovery, installNavigationRecovery, navigationRecoveryTarget, reloadNavigationTarget } from './navigation-recovery'

let dispose: (() => void) | undefined

function setup(error: Error = new TypeError('Failed to fetch dynamically imported module: /assets/Compendium-old.js')) {
  const browser = Object.assign(new EventTarget(), {
    location: { href: 'https://example.test/rooms?section=party', assign: vi.fn() },
    confirm: vi.fn(() => true),
  })
  vi.stubGlobal('window', browser)
  const router = createRouter({
    history: createMemoryHistory('/codex/'),
    routes: [
      { path: '/rooms', component: {} },
      { path: '/compendium', component: () => Promise.reject(error) },
      { path: '/other', component: {} },
    ],
  })
  dispose = installNavigationRecovery(router)
  return { browser, router }
}

afterEach(() => {
  dispose?.()
  dismissNavigationRecovery()
  vi.unstubAllGlobals()
})

describe('page loading recovery', () => {
  it('keeps the current route and remembers the failed destination, including base, query and hash', async () => {
    const { browser, router } = setup()
    await router.push('/rooms')
    await expect(router.push('/compendium?tab=monsters#dragon')).rejects.toThrow('dynamically imported module')
    expect(router.currentRoute.value.fullPath).toBe('/rooms')
    expect(navigationRecoveryTarget.value).toBe('/codex/compendium?tab=monsters#dragon')
    expect(browser.location.assign).not.toHaveBeenCalled()
    reloadNavigationTarget()
    expect(browser.location.assign).toHaveBeenCalledExactlyOnceWith('/codex/compendium?tab=monsters#dragon')
  })

  it('lets the user cancel a reload or dismiss the notice without losing the current page', async () => {
    const { browser, router } = setup()
    await router.push('/rooms')
    await router.push('/compendium').catch(() => {})
    browser.confirm.mockReturnValue(false)
    reloadNavigationTarget()
    expect(browser.location.assign).not.toHaveBeenCalled()
    expect(navigationRecoveryTarget.value).not.toBeNull()
    dismissNavigationRecovery()
    reloadNavigationTarget()
    expect(navigationRecoveryTarget.value).toBeNull()
    expect(browser.confirm).toHaveBeenCalledTimes(1)
  })

  it('respects navigation guards and clears an old notice after successful navigation', async () => {
    const { router } = setup()
    await router.push('/rooms')
    const unblock = router.beforeEach(() => false)
    await router.push('/compendium')
    expect(navigationRecoveryTarget.value).toBeNull()
    unblock()
    await router.push('/compendium').catch(() => {})
    const blockAgain = router.beforeEach(() => false)
    await router.push('/other')
    expect(navigationRecoveryTarget.value).not.toBeNull()
    blockAgain()
    await router.push('/other')
    expect(navigationRecoveryTarget.value).toBeNull()
  })

  it.each([
    'error loading dynamically imported module: /assets/old.js',
    'Importing a module script failed.',
    'Unable to preload CSS for /assets/old.css',
  ])('handles browser-specific import failures: %s', async message => {
    const { router } = setup(new Error(message))
    await router.push('/compendium').catch(() => {})
    expect(navigationRecoveryTarget.value).toBe('/codex/compendium')
  })

  it('offers a reload for an in-page lazy component failure without swallowing the error', () => {
    const { browser } = setup()
    const event = Object.assign(new Event('vite:preloadError', { cancelable: true }), {
      payload: new Error('Unable to preload CSS for /assets/old.css'),
    })
    browser.dispatchEvent(event)
    expect(navigationRecoveryTarget.value).toBe(browser.location.href)
    expect(event.defaultPrevented).toBe(false)
    expect(browser.location.assign).not.toHaveBeenCalled()
  })

  it('does not mislabel application errors as stale code', async () => {
    const { browser, router } = setup(new ReferenceError('missingVariable is not defined'))
    await router.push('/compendium').catch(() => {})
    browser.dispatchEvent(Object.assign(new Event('vite:preloadError'), { payload: new Error('Invalid data') }))
    expect(navigationRecoveryTarget.value).toBeNull()
    expect(browser.location.assign).not.toHaveBeenCalled()
  })
})
