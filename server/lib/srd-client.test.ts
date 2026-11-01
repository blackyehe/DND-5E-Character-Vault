import {afterEach,beforeEach,expect,it,vi} from 'vitest'

beforeEach(()=>{vi.resetModules();vi.useFakeTimers();vi.setSystemTime(0)})
afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()})
const reply=()=>new Response(JSON.stringify({index:'fixture',desc:['Complete rules']}),{headers:{'Content-Type':'application/json'}})

it('gives optional preloads a bounded low-priority attempt without import retries',async()=>{
 const starts:string[]=[];vi.stubGlobal('fetch',vi.fn(async(url:string)=>{starts.push(new URL(url).pathname);return starts.at(-1)==='/classes/optional'?new Response('',{status:429}):reply()}))
 const {readSrdRule}=await import('./srd-client')
 const foreground=Array.from({length:3},(_,i)=>readSrdRule('https://rules.test','features/foreground-'+i,{interactive:true}))
 const optional=readSrdRule('https://rules.test','classes/optional',{prefetch:true}),outcome=optional.catch(e=>e)
 await vi.runAllTimersAsync();await Promise.all(foreground);expect(await outcome).toBeInstanceOf(Error)
 expect(starts.at(-1)).toBe('/classes/optional');expect(starts.filter(p=>p==='/classes/optional')).toHaveLength(1)
})
it('stops optional upstream rules at their byte budget instead of buffering a large body',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({index:'huge',desc:['x'.repeat(256*1024)]}))))
 const {readSrdRule}=await import('./srd-client'),outcome=readSrdRule('https://rules.test','classes/huge',{prefetch:true}).catch(e=>e)
 await vi.runAllTimersAsync();expect(await outcome).toMatchObject({message:'Optional rule exceeds preload size'})
})

it('opens an interactive rule ahead of a long import queue while keeping the shared request pace',async()=>{
 const starts:{path:string;at:number}[]=[]
 vi.stubGlobal('fetch',vi.fn(async(url:string)=>{starts.push({path:new URL(url).pathname,at:Date.now()});return reply()}))
 const {readSrdRule}=await import('./srd-client')
 const bulk=Array.from({length:250},(_,i)=>readSrdRule('https://rules.test','features/import-'+i))
 await vi.advanceTimersByTimeAsync(5)
 const opened=readSrdRule('https://rules.test','classes/opened',{interactive:true})
 await vi.advanceTimersByTimeAsync(35)
 await expect(opened).resolves.toMatchObject({desc:['Complete rules']})
 expect(starts.slice(0,2).map(x=>x.path)).toEqual(['/features/import-0','/classes/opened'])
 expect(starts[1]!.at).toBe(40)
 await vi.runAllTimersAsync();await Promise.all(bulk)
 expect(starts).toHaveLength(251)
 expect(starts.every((s,i)=>i===0||s.at-starts[i-1]!.at>=40)).toBe(true)
})

it('bounds the entire interactive wait, including queue time, and never fetches an expired queued job',async()=>{
 const fetcher=vi.fn(async()=>reply());vi.stubGlobal('fetch',fetcher)
 const {readSrdRule}=await import('./srd-client')
 const requests=Array.from({length:110},(_,i)=>readSrdRule('https://rules.test','features/'+i,{interactive:true}))
 const outcomes=Promise.allSettled(requests)
 await vi.advanceTimersByTimeAsync(4000)
 const settled=await outcomes
 expect(settled.filter(x=>x.status==='fulfilled')).toHaveLength(100)
 expect(settled.filter(x=>x.status==='rejected')).toHaveLength(10)
 expect(fetcher).toHaveBeenCalledTimes(100)
 await vi.runAllTimersAsync();expect(fetcher).toHaveBeenCalledTimes(100)
})

it('keeps background work moving during sustained interactive traffic',async()=>{
 const starts:string[]=[];vi.stubGlobal('fetch',vi.fn(async(url:string)=>{starts.push(new URL(url).pathname);return reply()}))
 const {readSrdRule}=await import('./srd-client')
 const background=readSrdRule('https://rules.test','features/background')
 const foreground=Array.from({length:20},(_,i)=>readSrdRule('https://rules.test','classes/'+i,{interactive:true}))
 await vi.runAllTimersAsync();await Promise.all([background,...foreground])
 expect(starts.indexOf('/features/background')).toBe(8)
})

it('does not accumulate timer lateness into slower background-import throughput',async()=>{
 const timer=globalThis.setTimeout
 vi.stubGlobal('setTimeout',(callback:()=>void,delay=0)=>timer(callback,delay+6))
 const starts:number[]=[];vi.stubGlobal('fetch',vi.fn(async()=>{starts.push(Date.now());return reply()}))
 const {readSrdRule}=await import('./srd-client'),requests=Array.from({length:10},(_,i)=>readSrdRule('https://rules.test','features/'+i))
 await vi.runAllTimersAsync();await Promise.all(requests)
 expect(starts).toEqual([6,46,86,126,166,206,246,286,326,366])
})

it('coalesces identical reads and retains a successfully read response',async()=>{
 const fetcher=vi.fn(async()=>reply());vi.stubGlobal('fetch',fetcher)
 const {readSrdRule}=await import('./srd-client'),a=readSrdRule('https://rules.test','classes/one',{interactive:true}),b=readSrdRule('https://rules.test','classes/one',{interactive:true})
 await vi.runAllTimersAsync();expect(await a).toEqual(await b)
 expect(await readSrdRule('https://rules.test','classes/one',{interactive:true})).toMatchObject({index:'fixture'})
 expect(fetcher).toHaveBeenCalledTimes(1)
})

it('includes response-body reading in the interactive deadline and removes failed reads from cache',async()=>{
 let calls=0
 vi.stubGlobal('fetch',vi.fn(async(_url:string,{signal}:{signal:AbortSignal})=>{
  if(++calls>1)return reply()
  return {ok:true,status:200,json:()=>new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(signal.reason),{once:true}))}
 }))
 const {readSrdRule}=await import('./srd-client'),first=readSrdRule('https://rules.test','classes/one',{interactive:true}),failure=expect(first).rejects.toMatchObject({name:'TimeoutError'})
 await vi.advanceTimersByTimeAsync(4000);await failure
 const next=readSrdRule('https://rules.test','classes/one',{interactive:true});await vi.runAllTimersAsync();await expect(next).resolves.toMatchObject({index:'fixture'});expect(calls).toBe(2)
})

it('preserves missing-rule and busy-service behavior and background retry limits',async()=>{
 let calls=0
 vi.stubGlobal('fetch',vi.fn(async()=>{calls++;return new Response('',{status:429})}))
 const {readSrdRule}=await import('./srd-client'),busy=readSrdRule('https://rules.test','classes/busy',{interactive:true}),denied=expect(busy).rejects.toThrow('busy')
 await vi.runAllTimersAsync();await denied;expect(calls).toBe(1)
 const bulk=readSrdRule('https://rules.test','classes/bulk'),failed=expect(bulk).rejects.toThrow('still busy')
 await vi.runAllTimersAsync();await failed;expect(calls).toBe(5)
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('',{status:404})))
 const missing=readSrdRule('https://rules.test','classes/missing',{interactive:true});await vi.runAllTimersAsync();await expect(missing).resolves.toBeNull()
})
