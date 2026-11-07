import {afterEach, beforeEach, expect, it, vi} from 'vitest'
import {decodedMapImageUrl, loadMapImage, loadRoomMap} from './map-loading'
import {foregroundBusy} from './foreground-work'

const map = {id: 'map', title: 'Test map', pins: [], revision: 1}
const details = '/api/rooms/room/maps/map?previewCharacter=player'
const image = '/api/rooms/room/maps/map/image?previewCharacter=player'
const fetcher = vi.fn<typeof fetch>()
const success = (path: string) => path === details ? Response.json(map) : new Response('image bytes', {headers: {'Content-Type': 'image/webp'}})

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', fetcher)
  fetcher.mockReset().mockImplementation(async path => success(String(path)))
  vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
    const controller = new AbortController()
    setTimeout(() => controller.abort(new DOMException('Timeout', 'TimeoutError')), ms)
    return controller.signal
  })
})
afterEach(() => {vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers()})
const open = (signal = new AbortController().signal) => loadRoomMap(details, image, signal)

it('opens details and image concurrently, preserving credentials, preview scope and image revalidation', async () => {
  const pending = open()
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(foregroundBusy()).toBe(true)
  const result = await pending
  expect(result.map).toEqual(map)
  expect(await result.image.text()).toBe('image bytes')
  expect(fetcher.mock.calls.map(([path]) => path)).toEqual([details, image])
  for (const [, options] of fetcher.mock.calls) expect(options).toMatchObject({method: 'GET', credentials: 'include'})
  expect(fetcher.mock.calls[1]![1]?.cache).toBe('no-cache')
  expect(foregroundBusy()).toBe(false)
})

it.each([details, image])('recovers one transport failure without refetching the successful part: %s', async failed => {
  let attempts = 0
  fetcher.mockImplementation(async path => {
    if (path === failed && !attempts++) throw new TypeError('Failed to fetch')
    return success(String(path))
  })
  const result = open()
  await vi.advanceTimersByTimeAsync(250)
  expect((await result).map).toEqual(map)
  expect(fetcher.mock.calls.filter(([path]) => path === failed)).toHaveLength(2)
  expect(fetcher.mock.calls.filter(([path]) => path !== failed)).toHaveLength(1)
})

it.each([408, 502, 503, 504])('recovers one temporary HTTP %i read failure', async status => {
  let attempts = 0
  fetcher.mockImplementation(async path => path === image && !attempts++ ? new Response('', {status}) : success(String(path)))
  const result = open()
  await vi.advanceTimersByTimeAsync(250)
  expect((await result).map).toEqual(map)
  expect(attempts).toBe(2)
})

it.each([401, 403, 404, 429, 400, 500])('does not retry HTTP %i or hide its status', async status => {
  fetcher.mockImplementation(async path => path === image ? new Response('', {status}) : success(String(path)))
  await expect(open()).rejects.toMatchObject({status, stage: 'image', reason: 'http'})
  await vi.advanceTimersByTimeAsync(1000)
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(foregroundBusy()).toBe(false)
})

it('stops after the second network failure and identifies the failed stage', async () => {
  fetcher.mockImplementation(async path => {if (path === image) throw new TypeError('Failed to fetch'); return success(String(path))})
  const result = expect(open()).rejects.toMatchObject({stage: 'image', reason: 'network', message: expect.stringContaining('map image')})
  await vi.advanceTimersByTimeAsync(1000)
  await result
  expect(fetcher.mock.calls.filter(([path]) => path === image)).toHaveLength(2)
  expect(foregroundBusy()).toBe(false)
})

it('recovers a dropped response body but does not retry malformed JSON', async () => {
  let attempts = 0
  fetcher.mockImplementation(async path => {
    if (path === image && !attempts++) return {ok: true, headers: new Headers({'Content-Type':'image/webp'}), blob: async () => {throw new TypeError('Terminated')}} as unknown as Response
    return success(String(path))
  })
  const result = open()
  await vi.advanceTimersByTimeAsync(250)
  expect(await (await result).image.text()).toBe('image bytes')
  fetcher.mockClear().mockImplementation(async path => path === details ? new Response('invalid JSON') : success(String(path)))
  await expect(open()).rejects.toMatchObject({stage: 'details', reason: 'response'})
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('cancels during retry backoff without starting another request', async () => {
  const controller = new AbortController()
  fetcher.mockImplementation(async () => {throw new TypeError('offline')})
  const result = expect(open(controller.signal)).rejects.toMatchObject({name: 'AbortError'})
  await vi.advanceTimersByTimeAsync(100)
  controller.abort()
  await vi.advanceTimersByTimeAsync(500)
  await result
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(foregroundBusy()).toBe(false)
})

it('never dispatches an already cancelled opening', async () => {
  const controller = new AbortController(); controller.abort()
  await expect(open(controller.signal)).rejects.toMatchObject({name: 'AbortError'})
  expect(fetcher).not.toHaveBeenCalled()
})

it.each([{part: details, ms: 15000, stage: 'details'}, {part: image, ms: 20000, stage: 'image'}])('bounds response body reading by the original $ms ms deadline', async ({part, ms, stage}) => {
  fetcher.mockImplementation(async (path, options) => path !== part ? success(String(path)) : {
    ok: true,
    headers: new Headers({'Content-Type': 'image/webp'}),
    [stage === 'image' ? 'blob' : 'json']: () => new Promise((_, reject) => options!.signal!.addEventListener('abort', () => reject(options!.signal!.reason), {once: true})),
  } as unknown as Response)
  const result = expect(open()).rejects.toMatchObject({stage, reason: 'timeout'})
  await vi.advanceTimersByTimeAsync(ms)
  await result
  expect(fetcher).toHaveBeenCalledTimes(2)
  expect(foregroundBusy()).toBe(false)
})

it('keeps the original deadline across a retry and aborts the other pending part after failure', async () => {
  let detailsAttempts = 0, imageAborted = false
  fetcher.mockImplementation(async (path, options) => {
    if (path === details && !detailsAttempts++) throw new TypeError('dropped')
    return await new Promise<Response>((_, reject) => options!.signal!.addEventListener('abort', () => {
      if (path === image) imageAborted = true
      reject(options!.signal!.reason)
    }, {once: true}))
  })
  const result = expect(open()).rejects.toMatchObject({stage: 'details', reason: 'timeout'})
  await vi.advanceTimersByTimeAsync(15000)
  await result
  expect(detailsAttempts).toBe(2)
  expect(imageAborted).toBe(true)
  expect(fetcher).toHaveBeenCalledTimes(3)
  expect(foregroundBusy()).toBe(false)
})

const summary = {id:'map',title:'Map',audience:'room' as const,characterIds:[],revision:1,updatedAt:'',width:3072,height:4096,bytes:2776932,imageVariants:[{edge:1024,width:768,height:1024,bytes:178808},{edge:2048,width:1536,height:2048,bytes:703264}]}
const adaptive = {summary,viewport:{width:640,height:900,dpr:1}}
const variant = image + '&size=1024'

it('publishes authorized metadata before the selected overview body completes, with both requests concurrent',async()=>{
  let finish!:(response:Response)=>void
  fetcher.mockImplementation(async path=>path===details?success(details):new Promise<Response>(resolve=>{finish=resolve}))
  const onDetails=vi.fn(),onProgress=vi.fn(),pending=loadRoomMap(details,image,new AbortController().signal,{...adaptive,onDetails,onProgress})
  await vi.advanceTimersByTimeAsync(0)
  expect(onDetails).toHaveBeenCalledWith(map)
  expect(fetcher.mock.calls.map(([path])=>path)).toEqual([details,variant])
  expect(foregroundBusy()).toBe(true)
  finish(new Response('overview',{headers:{'Content-Type':'image/webp','Content-Length':'8','X-Map-Image-Edge':'1024'}}))
  const result=await pending
  expect(result.imageEdge).toBe(1024);expect(await result.image.text()).toBe('overview')
  expect(onProgress).toHaveBeenLastCalledWith({received:8,total:8})
  expect(foregroundBusy()).toBe(false)
})

it.each([401,403,404])('never falls back to the original after overview access HTTP %i',async status=>{
  fetcher.mockImplementation(async path=>path===variant?new Response('',{status}):success(String(path)))
  await expect(loadRoomMap(details,image,new AbortController().signal,adaptive)).rejects.toMatchObject({stage:'image',status})
  expect(fetcher.mock.calls.map(([path])=>path)).toEqual([details,variant])
})

it('falls back from a corrupt overview to the authorized original and reports its actual resolution',async()=>{
  fetcher.mockImplementation(async path=>path===variant?new Response('<html>unavailable</html>',{headers:{'Content-Type':'text/html'}}):success(String(path)))
  const result=await loadRoomMap(details,image,new AbortController().signal,adaptive)
  expect(result.imageEdge).toBe(4096);expect(await result.image.text()).toBe('image bytes')
  expect(fetcher.mock.calls.map(([path])=>path)).toEqual([details,variant,image])
})

it('recognizes an original served by a legacy/missing-derivative fallback without redownloading it',async()=>{
  fetcher.mockImplementation(async path=>path===details?success(details):new Response('original',{headers:{'Content-Type':'image/webp','X-Map-Image-Edge':'4096'}}))
  expect((await loadRoomMap(details,image,new AbortController().signal,adaptive)).imageEdge).toBe(4096)
  expect(fetcher).toHaveBeenCalledTimes(2)
})

it('shares the 20-second image deadline across overview retry and original fallback',async()=>{
  let attempts=0
  fetcher.mockImplementation(async(path,options)=>{
    if(path===details)return success(details)
    if(path===variant){if(!attempts++){await new Promise(resolve=>setTimeout(resolve,15000))};return new Response('',{status:503})}
    return new Promise<Response>((_,reject)=>options!.signal!.addEventListener('abort',()=>reject(options!.signal!.reason),{once:true}))
  })
  const pending=expect(loadRoomMap(details,image,new AbortController().signal,adaptive)).rejects.toMatchObject({stage:'image',reason:'timeout'})
  await vi.advanceTimersByTimeAsync(20000);await pending
  expect(fetcher.mock.calls.map(([path])=>path)).toEqual([details,variant,variant,image])
  expect(foregroundBusy()).toBe(false)
})

it('bounds streamed image bytes and reports progress even without a length',async()=>{
  const progress=vi.fn()
  fetcher.mockImplementation(async()=>new Response(new ReadableStream({start(c){c.enqueue(new Uint8Array([1,2]));c.enqueue(new Uint8Array([3,4,5]));c.close()}}),{headers:{'Content-Type':'image/webp'}}))
  expect((await loadMapImage(image,new AbortController().signal,{onProgress:progress})).image.size).toBe(5)
  expect(progress.mock.calls.map(([p])=>p.received)).toEqual([0,2,5])
  fetcher.mockImplementation(async()=>new Response(new Uint8Array(3*1024*1024+1),{headers:{'Content-Type':'image/webp'}}))
  await expect(loadMapImage(image,new AbortController().signal,{onProgress:progress})).rejects.toMatchObject({reason:'response'})
})

it('releases offscreen decode URLs on cancellation/failure and only publishes successfully loaded images',async()=>{
  let current:any
  vi.stubGlobal('Image',class {onload:any;onerror:any;src='';constructor(){current=this}})
  vi.spyOn(URL,'createObjectURL').mockReturnValue('blob:prepared')
  const revoke=vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{})
  const controller=new AbortController(),cancelled=expect(decodedMapImageUrl(new Blob(['image']),controller.signal)).rejects.toMatchObject({name:'AbortError'})
  controller.abort();await cancelled;expect(revoke).toHaveBeenCalledWith('blob:prepared')
  revoke.mockClear()
  const success=decodedMapImageUrl(new Blob(['image']),new AbortController().signal)
  current.onload();expect(await success).toBe('blob:prepared');expect(revoke).not.toHaveBeenCalled()
  const failed=expect(decodedMapImageUrl(new Blob(['image']),new AbortController().signal)).rejects.toMatchObject({reason:'response'})
  current.onerror();await failed;expect(revoke).toHaveBeenCalledOnce()
})
