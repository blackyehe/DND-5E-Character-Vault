// Seed first; then run before/after with the same server tsx loader.
// Outputs include initial parallel navigation+page cost, not just repeat-page savings.
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {createHash} from 'node:crypto'
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs'
import {connectFixture,mongoose,ids,fixture,database} from '../fixtures/notebook-compendium.mjs'
const require=createRequire(new URL('../../server/package.json',import.meta.url)),express=require('express'),cookieParser=require('cookie-parser'),jwt=require('jsonwebtoken')
const {BSON}=mongoose.mongo,phase=process.argv[2],out=process.env.NOTEBOOK_BENCHMARK_OUTPUT??'.local/notebook-navigation-20261102'
assert.ok(['before','after'].includes(phase),'Use before or after; seed the fixture first')
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'?Object.fromEntries(Object.keys(value).sort().map(k=>[k,canonical(value[k])])):value
const hash=value=>createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex')
const median=a=>a.toSorted((a,b)=>a-b)[Math.floor(a.length/2)]
const db=await connectFixture({monitorCommands:true}),client=mongoose.connection.getClient()
assert.equal(await db.collection('notebooks').countDocuments({kind:'entry',roomId:ids.room}),fixture.notebookEntries,'Run the retained fixture seed first')
mkdirSync(out,{recursive:true})
const {default:notebook}=await import('../../server/routes/notebook.ts'),{default:compendium}=await import('../../server/routes/compendium-browse.ts')
const app=express();app.use(cookieParser());app.use('/rooms/:roomId/notebook',notebook);app.use('/compendium',compendium)
app.use((error,_req,res,_next)=>res.status(error.status??500).json({error:error.message}))
const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s))}),base=`http://127.0.0.1:${server.address().port}`
let active;const started=new Map(),cursors=new Map()
client.on('commandStarted',event=>{
  if(!active)return
  let query
  if(event.command.find||event.command.aggregate){query={command:Object.fromEntries(Object.entries(event.command).filter(([k])=>['find','filter','projection','sort','skip','limit','collation','batchSize','hint','comment','aggregate','pipeline','cursor','singleBatch'].includes(k))),ms:0,bytes:0,roundTrips:0};active.queries.push(query)}
  else if(event.command.getMore)query=cursors.get(String(event.command.getMore))
  started.set(event.requestId,{sample:active,query})
})
client.on('commandSucceeded',event=>{
  const item=started.get(event.requestId);started.delete(event.requestId);if(!item)return
  item.sample.dbMs+=event.duration;item.sample.roundTrips++
  if(item.query){item.query.ms+=event.duration;item.query.roundTrips++;for(const row of event.reply?.cursor?.firstBatch??event.reply?.cursor?.nextBatch??[]){const bytes=BSON.calculateObjectSize(row);item.query.bytes+=bytes;item.sample.dbBytes+=bytes}if(event.reply?.cursor?.id)cursors.set(String(event.reply.cursor.id),item.query)}
})
async function request(paths,user){
  const sample={queries:[],dbMs:0,dbBytes:0,roundTrips:0},start=performance.now();active=sample
  try{sample.responses=await Promise.all(paths.map(async path=>{const response=await fetch(base+path,{headers:{Cookie:`token=${jwt.sign({userId:String(user)},process.env.JWT_SECRET)}`}}),raw=await response.text();assert.equal(response.status,200,raw);return {body:JSON.parse(raw),bytes:Buffer.byteLength(raw),scope:response.headers.get('X-Notebook-Scope')}}));sample.httpMs=performance.now()-start;sample.httpBytes=sample.responses.reduce((sum,r)=>sum+r.bytes,0);return sample}finally{active=undefined}
}
function stages(value,result=[]){if(!value||typeof value!=='object')return result;if(value.stage)result.push(value.stage);for(const [key,child]of Object.entries(value))if(key!=='rejectedPlans'&&child&&typeof child==='object')stages(child,result);return [...new Set(result)]}
async function summarize(paths,user){
  await request(paths,user);const samples=[];for(let n=0;n<5;n++)samples.push(await request(paths,user))
  const sample=samples.toSorted((a,b)=>a.httpMs-b.httpMs)[2],plans=[]
  for(const query of sample.queries){const explain=await db.command({explain:{...query.command,maxTimeMS:10000},verbosity:'executionStats'}),cursor=explain.stages?.find(s=>s.$cursor)?.$cursor,stats=explain.executionStats??cursor?.executionStats,winningPlan=explain.queryPlanner?.winningPlan??cursor?.queryPlanner?.winningPlan;plans.push({collection:query.command.find??query.command.aggregate,comment:query.command.comment,driverMs:query.ms,dbBytes:query.bytes,roundTrips:query.roundTrips,docsExamined:stats?.totalDocsExamined??0,keysExamined:stats?.totalKeysExamined??0,returned:stats?.nReturned??0,executionMs:stats?.executionTimeMillis??0,stages:stages(winningPlan),winningPlan})}
  return {httpMs:median(samples.map(s=>s.httpMs)),dbMs:median(samples.map(s=>s.dbMs)),dbBytes:sample.dbBytes,httpBytes:sample.httpBytes,roundTrips:sample.roundTrips,docsExamined:plans.reduce((sum,p)=>sum+p.docsExamined,0),keysExamined:plans.reduce((sum,p)=>sum+p.keysExamined,0),plans,bodies:sample.responses.map(r=>r.body)}
}
const cases=[...['all','journal','story-items'].flatMap(section=>['all','sessions'].flatMap(type=>[0,360].map(offset=>`section=${section}&type=${type}&offset=${offset}`))),'section=all&search=Synthetic%20prose','section=all&deleted=true','section=all&type=quests&questStatus=finished','section=all&tags=%5B%22City%22%5D']
const rows=[],compendiumRows=[]
try{
  const before=phase==='after'?JSON.parse(readFileSync(`${out}/before.json`)):null
  for(const role of ['dm','player'])for(const query of cases){
    const user=role==='dm'?ids.owner:ids.player,path=`/rooms/${ids.room}/notebook?${query}`,full=await summarize([path],user),contractHash=hash(full.bodies[0]);delete full.bodies
    if(before)assert.equal(contractHash,before.rows.find(row=>row.role===role&&row.query===query).contractHash,'Default listing contract changed: '+role+' '+query)
    const row={role,query,contractHash,default:full}
    if(phase==='after'){
      const lean=await summarize([path+'&navigation=false'],user),params=new URLSearchParams(query),navPath=`/rooms/${ids.room}/notebook/navigation?section=${params.get('section')}&deleted=${params.get('deleted')??'false'}`,nav=await summarize([navPath],user)
      assert.deepEqual(Object.keys(lean.bodies[0]).sort(),['entries','nextOffset','total'])
      assert.equal(hash({...nav.bodies[0],...lean.bodies[0]}),contractHash,'Split contract mismatch: '+role+' '+query)
      delete lean.bodies;delete nav.bodies;row.listing=lean;row.navigation=nav
      if(query==='section=all&type=all&offset=0'){
        const shared=process.env.NOTEBOOK_INITIAL_MODE==='shared'
        const initial=await summarize(shared?[`/rooms/${ids.room}/notebook/initial?${query}`]:[path+'&navigation=false',navPath],user)
        if(shared)assert.equal(hash({...initial.bodies[0].navigation,...initial.bodies[0].listing}),contractHash,'Initial shared contract mismatch')
        delete initial.bodies;row.initialParallel=initial;row.initialMode=shared?'shared-context':'parallel-http'
      }
    }
    rows.push(row)
  }
  for(const role of ['dm','player']){const user=role==='dm'?ids.owner:ids.player,first=await request(['/compendium/feats'],user),warm=await summarize(['/compendium/feats'],user);delete warm.bodies;compendiumRows.push({role,firstObserved:{httpMs:first.httpMs,dbMs:first.dbMs,dbBytes:first.dbBytes,httpBytes:first.httpBytes,roundTrips:first.roundTrips},warm})}
  const sourceHashes=Object.fromEntries(['server/routes/notebook.ts','server/lib/notebook-listing.ts'].map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]))
  const result={phase,scope:'Synthetic retained loopback fixture only. One warmup plus five HTTP samples; medians. ExecutionStats outside timing. DB bytes are BSON cursor documents, not compressed wire bytes. No fixture cleanup or production access.',database,fixture,sourceHashes,defaultContractsUnchanged:phase==='after',rows,compendium:compendiumRows}
  writeFileSync(`${out}/${phase}.json`,JSON.stringify(result,null,2))
  console.log(JSON.stringify({phase,cases:rows.length,defaultContractsUnchanged:result.defaultContractsUnchanged,shallow:rows.filter(row=>row.query==='section=all&type=all&offset=0').map(row=>({role:row.role,...Object.fromEntries(Object.entries(row).filter(([key])=>['default','listing','navigation','initialParallel'].includes(key)).map(([key,value])=>[key,Object.fromEntries(Object.entries(value).filter(([k])=>k!=='plans'))]))})),output:`${out}/${phase}.json`},null,2))
}finally{await new Promise(resolve=>server.close(resolve));await mongoose.disconnect()}
