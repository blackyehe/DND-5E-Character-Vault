import {Worker} from 'node:worker_threads'
import type {ParsedOrcbrew} from './orcbrew'

/** Isolate cold EDN parsing from the HTTP event loop. The worker is generated
 * from the canonical parser; its test rejects a stale generated artifact. */
export async function parseBackgroundPack(source:string,deadline:number):Promise<ParsedOrcbrew>{
 if(Buffer.byteLength(source)>16*1024*1024)throw Error('Background component source exceeds its limit')
 const remaining=Math.floor(deadline-performance.now())
 if(remaining<1000)throw Error('Background parsing deadline reached')
 return new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./orcbrew-background-worker.cjs',import.meta.url),{execArgv:[],resourceLimits:{maxOldGenerationSizeMb:256}})
  let settled=false
  const finish=(error?:Error,data?:Uint8Array)=>{
   if(settled)return;settled=true;clearTimeout(timer)
   void worker.terminate().catch(()=>{})
   if(error){reject(error);return}
   try{if(!data||data.byteLength>64*1024*1024)throw Error('Invalid background parser result');resolve(JSON.parse(Buffer.from(data.buffer,data.byteOffset,data.byteLength).toString('utf8')) as ParsedOrcbrew)}catch{reject(Error('Background parser result unavailable'))}
  }
  const timer=setTimeout(()=>finish(Error('Background parsing deadline reached')),remaining)
  worker.once('message',message=>finish(message.error?Error('Background pack parsing unavailable'):undefined,message.data))
  worker.once('error',()=>finish(Error('Background pack parser unavailable')))
  worker.once('exit',()=>{if(!settled)finish(Error('Background pack parser ended'))})
  try{worker.postMessage(source)}catch{finish(Error('Background pack parser unavailable'))}
 })
}
