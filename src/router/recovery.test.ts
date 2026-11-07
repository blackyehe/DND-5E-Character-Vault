import {beforeEach,describe,expect,it,vi} from 'vitest'
import {createSSRApp,h} from 'vue'
import {renderToString} from 'vue/server-renderer'
import {RouterView} from 'vue-router'

const auth=vi.hoisted(()=>({initialized:true,user:{id:'fixture'} as {id:string}|null}))
vi.mock('../stores/auth',()=>({useAuthStore:()=>auth}))
vi.mock('../lib/navigation-recovery',()=>({installNavigationRecovery:vi.fn()}))
vi.mock('../views/DashboardView.vue',()=>({default:{render:()=>null}}))
vi.mock('vue-router',async original=>{
  const actual=await original<typeof import('vue-router')>()
  return {...actual,createWebHistory:actual.createMemoryHistory}
})
import {router} from './index'

const render=()=>renderToString(createSSRApp({render:()=>h(RouterView)}).use(router))
beforeEach(()=>{auth.user={id:'fixture'}})
describe('navigation recovery',()=>{
  it('renders a recovery page for unknown authenticated addresses without capturing existing routes',async()=>{
    expect(router.resolve('/characters/new').name).toBe('character-new')
    expect(router.resolve('/characters/0123456789abcdef01234567').name).toBe('character')
    await router.push('/missing/audit-page?from=bookmark')
    expect(router.currentRoute.value.name).toBe('not-found')
    const html=await render()
    expect(html).toContain('This page could not be found.')
    expect(html).toMatch(/href="\/"[^>]*>Return to your characters/)
  })
  it('retains protected-route login redirection and renders named login controls',async()=>{
    auth.user=null
    await router.push('/compendium')
    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.next).toBe('/compendium')
    const html=await render()
    for(const field of ['email','password']){
      expect(html).toContain(`for="auth-${field}"`)
      expect(html).toContain(`id="auth-${field}"`)
    }
    expect(html).toContain('autocomplete="username"')
    expect(html).toContain('autocomplete="current-password"')
  })
})
