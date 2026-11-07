import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {api,ApiError} from './api'
vi.mock('./foreground-work',()=>({beginForegroundWork:()=>()=>{}}))
const fetchMock=vi.fn()
beforeEach(()=>{fetchMock.mockReset();vi.stubGlobal('fetch',fetchMock)})
afterEach(()=>vi.unstubAllGlobals())
it('exposes permission headers without changing parsed JSON or request cancellation',async()=>{
  fetchMock.mockResolvedValue(new Response(JSON.stringify({entries:[],total:0,nextOffset:null}),{headers:{'X-Notebook-Scope':'scope','X-Notebook-Navigation':'revision'}}))
  const seen=vi.fn(),controller=new AbortController()
  expect(await api.get('/api/rooms/room/notebook',{signal:controller.signal,onResponse:seen})).toEqual({entries:[],total:0,nextOffset:null})
  expect(seen).toHaveBeenCalledOnce();expect(seen.mock.calls[0]![0].headers.get('X-Notebook-Scope')).toBe('scope')
  controller.abort();expect(fetchMock.mock.calls[0]![1].signal.aborted).toBe(true)
})
it('exposes changed scope headers on errors and preserves the existing ApiError',async()=>{
  fetchMock.mockResolvedValue(new Response(JSON.stringify({error:'Access ended'}),{status:403,headers:{'X-Notebook-Scope':'revoked'}}))
  const seen=vi.fn()
  await expect(api.get('/api/rooms/room/notebook',{onResponse:seen})).rejects.toMatchObject({status:403,message:'Access ended'})
  expect(seen.mock.calls[0]![0].headers.get('X-Notebook-Scope')).toBe('revoked')
  fetchMock.mockResolvedValue(new Response('{}',{status:404}));await expect(api.get('/missing')).rejects.toBeInstanceOf(ApiError)
})
