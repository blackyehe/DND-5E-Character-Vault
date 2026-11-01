import assert from 'node:assert/strict'
import fs from 'node:fs'
import {randomBytes,createHash} from 'node:crypto'
import {createRequire} from 'node:module'

// Standalone experiment, not application code. No credentials/URI arguments.
if(process.argv.length!==3||process.argv[2]!=='--run'){
 console.log('Usage from the repository root: node --import ./server/node_modules/tsx/dist/loader.mjs scripts/probe-compendium-metadata-batch.mjs --run\nCreates and removes a unique synthetic database on 127.0.0.1:27017. Never uses the configured application database.')
 process.exit(process.argv.length>2&&process.argv[2]!=='--help'?1:0)
}
assert.ok(!process.env.VERCEL,'Run locally, outside Vercel')
const require=createRequire(new URL('../server/package.json',import.meta.url)),mongoose=require('mongoose')
const database='metadata_batch_probe_'+randomBytes(6).toString('hex'),uri='mongodb://127.0.0.1:27017/'+database+'?directConnection=true'
Object.assign(process.env,{MONGO_URI:uri,JWT_SECRET:'synthetic-metadata-probe-only',NODE_ENV:'development',COMPENDIUM_READER:'legacy',COMPENDIUM_PACK_PREPARATION:'off'})
const {CustomContent}=await import('../server/models/CustomContent.ts'),{browseRevision}=await import('../server/lib/compendium-browse.ts')
assert.equal(CustomContent.base,mongoose)
const code=fs.readFileSync(new URL('../server/lib/compendium-browse.ts',import.meta.url),'utf8'),version=code.match(/const INDEX_VERSION='([^']+)'/)?.[1]
assert.ok(version,'Review harness after revision format changes')
const projection='_id type updatedAt sourceHash data.includeDisabled',types=['orcbrew','item','compendium-edit'],owner=new mongoose.Types.ObjectId(),foreign=new mongoose.Types.ObjectId(),hash=s=>createHash('sha256').update(s).digest('hex'),results=[]
let observed,client,connected=false,cleaned=false
const observe=e=>{if(observed&&(e.commandName==='find'&&e.command.find===CustomContent.collection.name||e.commandName==='getMore'&&e.command.collection===CustomContent.collection.name))observed.push({command:e.commandName,...e.command.batchSize?{batchSize:e.command.batchSize}:{}})}
try{
 await mongoose.connect(uri,{autoCreate:false,autoIndex:false,monitorCommands:true,serverSelectionTimeoutMS:2500});connected=true
 assert.equal(mongoose.connection.host,'127.0.0.1');assert.equal(mongoose.connection.name,database)
 client=mongoose.connection.getClient();client.on('commandStarted',observe)
 for(const count of [0,126,600]){
  await CustomContent.collection.deleteMany({})
  const make=(userId,type,i)=>({_id:new mongoose.Types.ObjectId(),userId,type,sourceHash:hash('synthetic-'+i),updatedAt:new Date('2026-11-01T00:00:00Z'),data:{includeDisabled:i%2===0,source:'SYNTHETIC UNUSED PAYLOAD',filename:'synthetic.orcbrew'}})
  await CustomContent.collection.insertMany([...Array.from({length:count},(_,i)=>make(owner,types[i%types.length],i)),make(foreign,'orcbrew',-1),make(owner,'feat',-2)])
  observed=[];const baseline=await browseRevision(String(owner)),baselineCommands=observed;observed=undefined
  observed=[];const docs=await CustomContent.find({userId:String(owner),type:{$in:types}}).select(projection).sort({_id:1}).batchSize(512).lean(),candidateCommands=observed;observed=undefined
  assert.equal(docs.length,count,'No truncation, unrelated types or foreign documents')
  for(const doc of docs){assert.ok(!doc.data?.source);assert.ok(types.includes(doc.type))}
  assert.equal(hash(version+JSON.stringify(docs)),baseline,'Revision must remain identical to the actual application function')
  results.push({metadataDocuments:count,identicalRevision:true,baselineCommands,candidateCommands,baselineCursorContinuations:baselineCommands.filter(c=>c.command==='getMore').length,candidateCursorContinuations:candidateCommands.filter(c=>c.command==='getMore').length})
 }
}finally{
 observed=undefined;if(client)client.off('commandStarted',observe)
 if(connected){assert.equal(mongoose.connection.host,'127.0.0.1');assert.equal(mongoose.connection.name,database);assert.match(database,/^metadata_batch_probe_[a-f0-9]{12}$/);await mongoose.connection.dropDatabase();cleaned=true}
 await mongoose.disconnect()
}
console.log(JSON.stringify({syntheticLocalOnly:true,applicationUnchanged:true,batchSize:512,fixtureCleaned:cleaned,notice:'Command-count experiment only; not a live timing or a speed guarantee.',results},null,2))
