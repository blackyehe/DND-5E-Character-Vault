const cache = new Map<string, { expires:number; value:Promise<unknown> }>()
let nextRequest = 0
const delay = (ms:number) => new Promise<void>(resolve=>setTimeout(resolve,ms))

/** The local SRD service limits requests; imports must not treat a 429 as a missing rule. */
export async function readSrdRule(base:string,path:string,options:{interactive?:boolean}={}):Promise<unknown> {
  const url=`${base.replace(/\/$/,'')}/${path}`
  const cacheKey=url+(options.interactive?'|interactive':'')
  const existing=cache.get(cacheKey)
  if(existing&&existing.expires>Date.now())return existing.value
  if(cache.size>=2000)cache.delete(cache.keys().next().value!)
  const value=(async()=>{
    for(let attempt=0;attempt<(options.interactive?1:4);attempt++){
      const starts=Math.max(Date.now(),nextRequest);nextRequest=starts+40
      await delay(Math.max(0,starts-Date.now()))
      const response=await fetch(url,{signal:AbortSignal.timeout(options.interactive?4000:8000)})
      if(response.status===404)return null
      if(response.status===429){
        if(options.interactive){await response.body?.cancel();throw new Error('Rules service is busy')}
        const reset=Number(response.headers.get('x-ratelimit-reset'))*1000-Date.now()+150
        await response.body?.cancel()
        await delay(Math.min(6000,Math.max(500,Number.isFinite(reset)?reset:1000)))
        continue
      }
      if(!response.ok){await response.body?.cancel();throw new Error(`Rules lookup ${path}: ${response.status}`)}
      return response.json()
    }
    throw new Error(`Rules lookup ${path} is still busy`)
  })()
  cache.set(cacheKey,{expires:Date.now()+10*60*1000,value})
  try{return await value}catch(error){cache.delete(cacheKey);throw error}
}
