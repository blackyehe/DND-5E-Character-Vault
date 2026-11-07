import {beforeEach,expect,it,vi} from 'vitest'
import {loadWorkshopStartup} from './workshop-startup'
import {api,ApiError} from './api'
import {homebrew} from './srd'
vi.mock('./api',async original=>({...await original<typeof import('./api')>(),api:{get:vi.fn()}}))
vi.mock('./srd',()=>({homebrew:{classes:vi.fn(),subclasses:vi.fn(),races:vi.fn(),spells:vi.fn()}}))
const readers=[homebrew.classes,homebrew.subclasses,homebrew.races,homebrew.spells]
beforeEach(()=>vi.clearAllMocks())
it('loads all five imported-library parts with one authenticated API call',async()=>{
 const result={classes:[{index:'class'}],subclasses:[],races:[],spells:[],library:{packs:[],rules:[],warnings:[]}}
 vi.mocked(api.get).mockResolvedValue(result)
 expect(await loadWorkshopStartup()).toEqual(result)
 expect(api.get).toHaveBeenCalledExactlyOnceWith('/api/workshop/initial')
 for(const fn of readers)expect(fn).not.toHaveBeenCalled()
})
it('supports an old backend on 404 but never fans out a timeout, access failure or server error',async()=>{
 vi.mocked(api.get).mockRejectedValueOnce(new ApiError(404,'older backend')).mockResolvedValueOnce({packs:[],rules:[],warnings:[]})
 for(const fn of readers)vi.mocked(fn).mockResolvedValue([])
 expect((await loadWorkshopStartup()).classes).toEqual([])
 for(const fn of readers)expect(fn).toHaveBeenCalledOnce()
 for(const error of [new ApiError(401,'expired'),new ApiError(503,'offline'),new TypeError('timeout')]){
  vi.clearAllMocks();vi.mocked(api.get).mockRejectedValueOnce(error)
  await expect(loadWorkshopStartup()).rejects.toBe(error)
  expect(api.get).toHaveBeenCalledOnce();for(const fn of readers)expect(fn).not.toHaveBeenCalled()
 }
})
