import {waitForSrdRequest} from './srd-request-queue'
import {COMPENDIUM_PRELOAD_LIMITS} from '../../shared/compendium-details'

const cache = new Map<string, { expires:number; value:Promise<unknown> }>()
const delay = (ms:number) => new Promise<void>(resolve=>setTimeout(resolve,ms))

/** The local SRD service limits requests; imports must not treat a 429 as a missing rule. */
export async function readSrdRule(base:string,path:string,options:{interactive?:boolean;prefetch?:boolean}={}):Promise<unknown> {
  const url=`${base.replace(/\/$/,'')}/${path}`
  const cacheKey=url+(options.interactive?'|interactive':options.prefetch?'|prefetch':'')
  const existing=cache.get(cacheKey)
  if(existing&&existing.expires>Date.now())return existing.value
  if(cache.size>=2000)cache.delete(cache.keys().next().value!)
  const value=(async()=>{
    const deadline=options.interactive||options.prefetch?new AbortController():undefined
    const timeout=deadline?setTimeout(()=>deadline.abort(new DOMException('Rules request timed out','TimeoutError')),4000):undefined
    try{
    for(let attempt=0;attempt<(options.interactive||options.prefetch?1:4);attempt++){
      await waitForSrdRequest(options.interactive===true,deadline?.signal)
      const response=await fetch(url,{signal:deadline?.signal??AbortSignal.timeout(8000)})
      if(response.status===404)return null
      if(response.status===429){
        if(options.interactive||options.prefetch){await response.body?.cancel();throw new Error('Rules service is busy')}
        const reset=Number(response.headers.get('x-ratelimit-reset'))*1000-Date.now()+150
        await response.body?.cancel()
        await delay(Math.min(6000,Math.max(500,Number.isFinite(reset)?reset:1000)))
        continue
      }
      if(!response.ok){await response.body?.cancel();throw new Error(`Rules lookup ${path}: ${response.status}`)}
      if(options.prefetch){
        const reader=response.body?.getReader();if(!reader)return null
        const chunks:Uint8Array[]=[];let bytes=0
        try{for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>COMPENDIUM_PRELOAD_LIMITS.entryBytes)throw Error('Optional rule exceeds preload size');chunks.push(part.value)}}catch(error){await reader.cancel().catch(()=>{});throw error}finally{reader.releaseLock()}
        const body=new Uint8Array(bytes);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength}
        return JSON.parse(new TextDecoder().decode(body)) as unknown
      }
      return await response.json()
    }
    throw new Error(`Rules lookup ${path} is still busy`)
    }finally{clearTimeout(timeout)}
  })()
  cache.set(cacheKey,{expires:Date.now()+10*60*1000,value})
  try{return await value}catch(error){cache.delete(cacheKey);throw error}
}
