// Run from the repository root with the server's tsx loader. Synthetic, loopback only.
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs'
import {randomBytes,createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {pathToFileURL} from 'node:url'
import {resolve} from 'node:path'
const require=createRequire(new URL('../../server/package.json',import.meta.url))
const mongoose=require('mongoose'),express=require('express'),jwt=require('jsonwebtoken'),cookieParser=require('cookie-parser')
const {BSON}=mongoose.mongo
const phase=process.argv[2]
assert.ok(['baseline','after'].includes(phase),'Use baseline or after')
assert.ok(!process.env.VERCEL,'Loopback fixture only')
const database='notebook_listing_probe_'+randomBytes(6).toString('hex')
const fixturePort=Number(process.env.NOTEBOOK_BENCH_PORT??27017)
assert.ok(Number.isInteger(fixturePort)&&fixturePort>=1024&&fixturePort<=65535)
Object.assign(process.env,{MONGO_URI:`mongodb://127.0.0.1:${fixturePort}/${database}?directConnection=true`,JWT_SECRET:'synthetic-notebook-benchmark-only',NODE_ENV:'development',COMPENDIUM_READER:'legacy',COMPENDIUM_PACK_PREPARATION:'off',NOTEBOOK_DB_LISTING:phase==='after'?'on':'off'})
const oid=n=>new mongoose.Types.ObjectId(n.toString(16).padStart(24,'0'))
const ids={owner:oid(1),player:oid(2),other:oid(3),room:oid(4),character:oid(5),foreignCharacter:oid(6),folder:oid(7)}
process.env.NOTEBOOK_DB_ROOMS=String(ids.room)
const now=new Date('2026-11-02T00:00:00Z'),out=process.env.NOTEBOOK_BENCH_OUT??'.local/notebook-query-20261102'
mkdirSync(out,{recursive:true})
if(phase==='baseline'){
 const ref=process.env.NOTEBOOK_BASELINE_REF??'HEAD'
 let source=execFileSync('git',['show',`${ref}:server/routes/notebook.ts`],{encoding:'utf8'})
 assert.ok(!source.includes('notebookListing'),'Choose the pre-change NOTEBOOK_BASELINE_REF')
 source=source.replaceAll("from '../",`from '${pathToFileURL(resolve('server')+'/').href}`)
 for(const pkg of ['express','mongoose','zod'])source=source.replaceAll(`from '${pkg}'`,`from '${pathToFileURL(require.resolve(pkg)).href}'`)
 writeFileSync(`${out}/baseline-notebook.ts`,source)
}
let server,active,client
const commands=new Map()
const cursors=new Map()
const metrics=()=>({dbMs:0,dbBsonBytes:0,commands:0,returnedRows:0})
function stage(command){if(command.getMore)return cursors.get(String(command.getMore))??'compendium';if(command.comment==='notebook-readiness')return 'readiness';if(command.comment==='notebook-listing')return 'listing';if(command.comment==='notebook-navigation')return 'navigationCounts';if(command.find==='notebooks')return command.filter?.kind==='folder'?'navigationContext':'listing';if(command.aggregate==='notebooks')return 'navigationCounts';if(command.count==='notebooks')return 'navigationCounts';if(command.find==='rooms'||command.find==='characters')return 'access';return 'compendium'}
function trackStart(e){if(active){const label=stage(e.command);commands.set(e.requestId,{label,sample:active});if(e.command.find||e.command.aggregate)active.readCommands.push({label,command:Object.fromEntries(Object.entries(e.command).filter(([key])=>['find','filter','projection','sort','skip','limit','collation','batchSize','hint','comment','aggregate','pipeline','cursor'].includes(key)))})}}
function trackEnd(e){const c=commands.get(e.requestId);commands.delete(e.requestId);if(!c)return;if(e.reply?.cursor?.id)cursors.set(String(e.reply.cursor.id),c.label);const m=c.sample.stages[c.label]??=metrics();m.dbMs+=e.duration;m.commands++;for(const row of e.reply?.cursor?.firstBatch??e.reply?.cursor?.nextBatch??[]){m.dbBsonBytes+=BSON.calculateObjectSize(row);m.returnedRows++}}
try{
 await mongoose.connect(process.env.MONGO_URI,{autoCreate:false,autoIndex:false,monitorCommands:true,serverSelectionTimeoutMS:2500});client=mongoose.connection.getClient()
 assert.equal(mongoose.connection.host,'127.0.0.1');assert.equal(mongoose.connection.name,database)
 const db=mongoose.connection.db
 const entries=Array.from({length:3600},(_,n)=>{const section=n<2400?'journal':'story-items',session=n<1200,kind=session?'sessions':section==='story-items'?'objects':['people','places','quests','factions'][n%4];return {_id:oid(n+100),roomId:ids.room,kind:'entry',section,codexType:n%13===0?null:kind,title:session?`Session ${String(n+1).padStart(4,'0')}`:`${['Árvíz','Család','Csillag','Duna','Zár'][n%5]} ${String(n).padStart(4,'0')}`,body:`Description ${n} ${'Synthetic prose. '.repeat(95)}\n\n## Session sources\n- ${session?n+1:7}. session.`,questClues:kind==='quests'?[{id:'fixture',title:'Private clue',body:'Not in lists',sessions:[],audience:'dm'}]:[],folderId:n%3===0?ids.folder:null,parentId:null,audience:['dm','room','characters','characters'][n%4],characterIds:n%4===2?[ids.character]:n%4===3?[ids.foreignCharacter]:[],relevantCharacterIds:[ids.character],relatedIds:[],revision:1,deletedAt:n%29===0?now:null,editedBy:'Fixture DM',createdBy:ids.owner,createdAt:now,updatedAt:now,tags:n%2?['City','Plot']:['Plot'],coverImage:'not-real-image',gallery:[]}})
 await db.collection('rooms').insertOne({_id:ids.room,ownerId:ids.owner,name:'Synthetic room',members:[ids.player,ids.other],assignments:[{characterId:ids.character,userId:ids.player},{characterId:ids.foreignCharacter,userId:ids.other}],notebookTagCatalog:[{key:'unused',name:'Unused'}]})
 await db.collection('characters').insertMany([{_id:ids.character,userId:ids.owner,meta:{name:'Fixture character'}},{_id:ids.foreignCharacter,userId:ids.owner,meta:{name:'Other character'}}])
 await db.collection('notebooks').insertMany([{_id:ids.folder,roomId:ids.room,kind:'folder',section:'journal',title:'Folder',parentId:null,characterIds:[],audience:'room',revision:1,deletedAt:null,updatedAt:now},...entries])
 await db.collection('notebooks').createIndex({roomId:1,kind:1,section:1,deletedAt:1,title:1,_id:1})
 await db.collection('notebooks').createIndex({roomId:1,relatedIds:1})
 await db.collection('characters').createIndex({userId:1})
 await db.collection('customcontents').createIndex({userId:1,type:1})
 const packs=Array.from({length:60},(_,p)=>{const source=`{:orcpub.dnd.e5/feats {${Array.from({length:25},(_,n)=>`:fixture-${p}-${n} {:name "Fixture ${p} ${n}" :description "${'Synthetic definition. '.repeat(30)}"}`).join(' ')}}}`;return {_id:oid(10000+p),userId:ids.owner,type:'orcbrew',sourceHash:createHash('sha256').update(source).digest('hex'),updatedAt:now,data:{filename:`fixture-${p}.orcbrew`,source,includeDisabled:false}}})
 await db.collection('customcontents').insertMany(packs)
 if(phase==='after'){
  const {backfillNotebookListing,certifyNotebookRoom}=await import('../../server/lib/notebook-backfill.ts')
  const migrated=await backfillNotebookListing(db.collection('notebooks'),{apply:true})
  assert.equal(migrated.updated,entries.length);assert.equal(migrated.complete,true)
  assert.equal((await backfillNotebookListing(db.collection('notebooks'))).inconsistent,0)
  assert.equal((await certifyNotebookRoom(db.collection('notebooks'),db.collection('rooms'),ids.room)).ready,true)
  const {notebookDatabaseReady}=await import('../../server/lib/notebook-listing.ts')
  assert.ok(notebookDatabaseReady({room:await db.collection('rooms').findOne({_id:ids.room})}),'The after cohort must actually use the certified allowlisted reader')
 }
 const {Notebook}=await import('../../server/models/Notebook.ts')
 if(phase==='after')for(const [key,options]of Notebook.schema.indexes())await db.collection('notebooks').createIndex(key,options)
 const {default:notebook}=await import(phase==='baseline'?pathToFileURL(resolve(out,'baseline-notebook.ts')).href:'../../server/routes/notebook.ts')
 const {default:compendium}=await import('../../server/routes/compendium-browse.ts')
 const app=express();app.use(cookieParser());app.use('/rooms/:roomId/notebook',notebook);app.use('/compendium',compendium)
 app.use((e,req,res,next)=>{console.error(e);res.status(500).json({error:e.name})})
 server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));const base=`http://127.0.0.1:${server.address().port}`
 client.on('commandStarted',trackStart);client.on('commandSucceeded',trackEnd)
 async function request(path,user){const sample={stages:{},readCommands:[]};active=sample;const started=performance.now();const response=await fetch(base+path,{headers:{Cookie:`token=${jwt.sign({userId:String(user)},process.env.JWT_SECRET)}`}});const body=await response.text();sample.httpMs=performance.now()-started;sample.httpBytes=Buffer.byteLength(body);sample.body=JSON.parse(body);assert.equal(response.status,200,body);active=undefined;return sample}
 function planStages(p,out=[]){if(!p||typeof p!=='object')return out;if(p.stage)out.push(p.stage);for(const [k,v]of Object.entries(p))if(k!=='rejectedPlans'&&v&&typeof v==='object')planStages(v,out);return [...new Set(out)]}
 async function explain(read){const e=await db.command({explain:{...read.command,maxTimeMS:5000},verbosity:'executionStats'});const cursors=e.stages?.filter(s=>s.$cursor).map(s=>s.$cursor)??[],stats=e.executionStats??cursors[0]?.executionStats,plan=e.queryPlanner?.winningPlan??cursors[0]?.queryPlanner?.winningPlan;return {stage:read.label,collection:read.command.find??read.command.aggregate,collation:read.command.collation??null,indexNames:[...new Set([...JSON.stringify(plan??{}).matchAll(/"indexName":"([^"]+)"/g)].map(m=>m[1]))],stages:planStages(plan),docsExamined:stats?.totalDocsExamined??null,keysExamined:stats?.totalKeysExamined??null,returned:stats?.nReturned??null,executionMs:stats?.executionTimeMillis??null}}
 const rows=[]
 for(const role of ['dm','player'])for(const section of ['all','journal','story-items'])for(const ordering of ['mixed','sessions'])for(const offset of [0,360]){
  const path=`/rooms/${ids.room}/notebook?section=${section}&type=${ordering==='sessions'?'sessions':'all'}&offset=${offset}`,user=role==='dm'?ids.owner:ids.player
  await request(path,user)
  const samples=[];for(let n=0;n<3;n++)samples.push(await request(path,user))
  const median=values=>values.toSorted((a,b)=>a-b)[Math.floor(values.length/2)],last=samples.at(-1)
  const plans=[];for(const read of last.readCommands)plans.push(await explain(read))
  if(phase==='after')for(const read of last.readCommands.filter(r=>r.label==='listing'&&r.command.find)){for(const required of ['_id','title','listing'])assert.equal(read.command.projection[required],1,'Must use the positive metadata-only projection');for(const forbidden of ['body','questClues','coverImage','gallery'])assert.ok(!read.command.projection[forbidden],`Unexpected ${forbidden} in listing projection`)}
  if(phase==='after')for(const p of plans.filter(p=>p.stage==='listing'||p.stage==='navigationCounts'))assert.ok(!p.stages.includes('SORT'),JSON.stringify({role,section,ordering,offset,p}))
  rows.push({role,section,ordering,offset,httpMs:median(samples.map(s=>s.httpMs)),httpBytes:last.httpBytes,entries:last.body.entries.length,total:last.body.total,stages:Object.fromEntries([...new Set(samples.flatMap(s=>Object.keys(s.stages)))].map(stage=>[stage,Object.fromEntries(Object.keys(metrics()).map(key=>[key,median(samples.map(s=>s.stages[stage]?.[key]??0))]))])),plans,contract:last.body})
 }
 const compendiumSamples=[]
 for(let n=0;n<4;n++){const s=await request('/compendium/feats',ids.owner);compendiumSamples.push({cache:n?'warm':'application-cache-miss',httpMs:s.httpMs,httpBytes:s.httpBytes,stages:s.stages,entries:s.body.totalEntries})}
 // Additional behavioral comparisons run after the timed, identical matrix.
 for(const [n,changes]of [[1302,{tags:['  City ','CITY','Árvíz'],questStatus:'finished'}],[1401,{showInEvents:true}],[1402,{codexType:'events'}]]){
  const doc={...entries[n],...changes},set={...changes}
  if(phase==='after'){const {notebookDerived}=await import('../../server/lib/notebook-derived.ts');set.listing=notebookDerived(doc)}
  await db.collection('notebooks').updateOne({_id:doc._id},{$set:set})
 }
 const regressionRows=[]
 const paths=['section=all&type=objects','section=all&type=places','section=all&type=quests&questStatus=active','section=all&type=quests&questStatus=finished','section=all&type=events','section=all&tags='+encodeURIComponent('["CITY"]'),'section=all&tags='+encodeURIComponent('["árvíz"]'),'section=all&folder=unfiled','section=journal&folder='+ids.folder,'section=all&character='+ids.character,'section=all&type=pinned','section=all&type=pinned&ids='+[entries[1302]._id,entries[1300]._id].join(','),'section=all&deleted=true','section=all&deleted=true&offset=60','section=all&search=Synthetic%20prose','section=all&search=Private%20clue','section=all&search=Not%20in%20lists']
 for(const role of ['dm','player'])for(const path of paths){const s=await request(`/rooms/${ids.room}/notebook?${path}`,role==='dm'?ids.owner:ids.player);regressionRows.push({role,path,contract:s.body})}
 const report={phase,scope:'Synthetic loopback fixtures only; no production measurements. Original populated baseline captured before any application migration.',fixture:{entries:entries.length,packs:packs.length,definitions:1500,bodyCharacters:entries[0].body.length},rows,compendiumSamples,regressionRows}
 if(phase==='after'){
  const baseline=JSON.parse(readFileSync(`${out}/baseline.json`,'utf8'))
  for(let i=0;i<rows.length;i++)assert.deepEqual(rows[i].contract,baseline.rows[i].contract,JSON.stringify({role:rows[i].role,section:rows[i].section,ordering:rows[i].ordering,offset:rows[i].offset}))
  for(let i=0;i<regressionRows.length;i++)assert.deepEqual(regressionRows[i],baseline.regressionRows[i],JSON.stringify({regression:i,role:regressionRows[i].role,path:regressionRows[i].path}))
  report.baselineContractsIdentical=true
  const {backfillNotebookListing}=await import('../../server/lib/notebook-backfill.ts')
  const path=`/rooms/${ids.room}/notebook?section=all`,prepared=await request(path,ids.owner)
  await db.collection('notebooks').updateOne({_id:entries[1]._id},{$unset:{listing:1}})
  assert.deepEqual((await request(path,ids.owner)).body,prepared.body,'Missing metadata must retain legacy reading without changing the response')
  assert.equal((await backfillNotebookListing(db.collection('notebooks'),{apply:true})).updated,1)
  await db.collection('notebooks').updateOne({_id:entries[1]._id},{$set:{'listing.sessions':[9999]}})
  assert.equal((await backfillNotebookListing(db.collection('notebooks'))).inconsistent,1)
  assert.equal((await backfillNotebookListing(db.collection('notebooks'),{apply:true})).updated,1)
  assert.equal((await backfillNotebookListing(db.collection('notebooks'))).inconsistent,0)
  report.legacyFallbackAndDriftRepairVerified=true
 }
 writeFileSync(`${out}/${phase}.json`,JSON.stringify(report,null,2))
 console.log(JSON.stringify({phase,fixture:report.fixture,matrixCases:rows.length,regressionCases:regressionRows.length,contractsIdentical:report.baselineContractsIdentical,compendiumSamples,output:`${out}/${phase}.json`},null,2))
}finally{
 active=undefined;if(server)await new Promise(resolve=>server.close(resolve))
 if(client){client.off('commandStarted',trackStart);client.off('commandSucceeded',trackEnd);assert.equal(mongoose.connection.host,'127.0.0.1');assert.match(database,/^notebook_listing_probe_[a-f0-9]{12}$/);assert.equal(mongoose.connection.name,database);await mongoose.connection.dropDatabase()}
 await mongoose.disconnect()
}
