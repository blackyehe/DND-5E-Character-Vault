import {describe,expect,it} from 'vitest'
import {evaluateMapDelivery} from './map-delivery-acceptance.mjs'

function fixture(){
 const golden={bytes:2776932,sha256:'a'.repeat(64),width:3072,height:4096}
 const reports=[{id:'control-deployment',exact:true,files:423},{id:'candidate-deployment',exact:true,files:423}]
 const records:any[]=[]
 for(const [cohort,count]of [['full',24],['cold',12],['warm',12]] as const)for(let pair=0;pair<count;pair++)for(const label of pair%2?['candidate','control']:['control','candidate']){
  const ms=(cohort==='warm'?200:label==='control'?1200:650)+pair%5
  records.push({cohort,pair,label,ms,width:golden.width,height:golden.height,...(cohort==='full'?{bytes:golden.bytes,sha256:golden.sha256,contentLength:label==='candidate'?String(golden.bytes):null,cacheControl:'private, no-cache'}:{errors:[],resources:[{encodedBytes:golden.bytes,transferBytes:cohort==='warm'?300:golden.bytes+300}]})})
 }
 const warmups=['full','cold','warm'].flatMap(cohort=>['control','candidate'].map(label=>({cohort,label,ms:500})))
 return {plan:{registeredAt:'2026-11-02T00:00:00Z',sourceFiles:423,measurements:{browserFullImagePairs:24,browserUiColdPairs:12,browserUiWarmPairs:12}},browser:{done:true,phase:'complete',startedAt:'2026-11-02T01:00:00Z',errors:[] as string[],records,warmups},golden,security:{passed:true,cleaned:true,checks:Array.from({length:8},()=>({passed:true}))},audit:{passed:true,productionUnchanged:true,reports},postflight:{passed:true,productionUnchanged:true,reports}}
}
describe('map delivery automated acceptance gate',()=>{
 it('passes complete, meaningful paired improvements with matching images and unchanged access',()=>expect(evaluateMapDelivery(fixture()).decision).toBe('PASS'))
 it('holds a slowdown even when every correctness check passes',()=>{const f=fixture();for(const r of f.browser.records)if(r.label==='candidate')r.ms=2000;expect(evaluateMapDelivery(f).decision).toBe('HOLD')})
 it('holds a statistically consistent but negligible gain',()=>{const f=fixture();for(const r of f.browser.records)if(r.label==='candidate'&&r.cohort!=='warm')r.ms=1170;expect(evaluateMapDelivery(f).decision).toBe('HOLD')})
 it('holds an incomplete cohort instead of selecting only successful pairs',()=>{const f=fixture();f.browser.records.pop();expect(evaluateMapDelivery(f).decision).toBe('HOLD')})
 it('holds a missing warmup instead of mislabeling a cold first request',()=>{const f=fixture();f.browser.warmups.pop();expect(evaluateMapDelivery(f).decision).toBe('HOLD')})
 it('holds altered image bytes despite excellent timings',()=>{const f=fixture();f.browser.records[0].sha256='b'.repeat(64);expect(evaluateMapDelivery(f).decision).toBe('HOLD')})
 it('holds missing access checks, failed cleanup, source mismatch and page errors',()=>{
  for(const mutate of [(f:any)=>{f.security.passed=false},(f:any)=>{f.security.cleaned=false},(f:any)=>{f.audit.productionUnchanged=false},(f:any)=>{f.browser.errors.push('Page failure')}]){const f=fixture();mutate(f);expect(evaluateMapDelivery(f).decision).toBe('HOLD')}
 })
 it('holds a warm-cache tail regression despite cold-load improvements',()=>{const f=fixture();for(const r of f.browser.records)if(r.cohort==='warm'&&r.label==='candidate'&&r.pair<3)r.ms=3000;expect(evaluateMapDelivery(f).decision).toBe('HOLD')})
 it('holds a cold cohort that accidentally reused image bytes',()=>{const f=fixture();f.browser.records.find(r=>r.cohort==='cold').resources[0].transferBytes=300;expect(evaluateMapDelivery(f).decision).toBe('HOLD')})
})
