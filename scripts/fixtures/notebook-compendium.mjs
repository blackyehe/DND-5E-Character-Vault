// Retained, deterministic, loopback-only fixture. Run with the server tsx loader:
// node --import ./server/node_modules/tsx/dist/loader.mjs scripts/fixtures/notebook-compendium.mjs
// Re-running replaces only the known synthetic records. This script never drops a database.
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
const require=createRequire(new URL('../../server/package.json',import.meta.url))
export const mongoose=require('mongoose')
export const database='notebook_navigation_fixture_v1'
export const uri=`mongodb://127.0.0.1:27017/${database}?directConnection=true`
const oid=n=>new mongoose.Types.ObjectId(n.toString(16).padStart(24,'0'))
export const ids={owner:oid(1),player:oid(2),other:oid(3),room:oid(4),character:oid(5),foreignCharacter:oid(6),folder:oid(7)}
export const fixture={version:1,notebookEntries:3600,packsPerOwner:60,definitionsPerOwner:1500,actors:['dm','player']}
export function configureFixture(){
  assert.ok(!process.env.VERCEL,'Fixtures cannot run on a deployment')
  Object.assign(process.env,{MONGO_URI:uri,JWT_SECRET:'synthetic-navigation-fixture-only',NODE_ENV:'development',COMPENDIUM_READER:'legacy',COMPENDIUM_PACK_PREPARATION:'off',REQUEST_TIMING:'off',NOTEBOOK_DB_LISTING:process.env.NOTEBOOK_FIXTURE_DB_LISTING??'on'})
  mongoose.set('autoCreate',false);mongoose.set('autoIndex',false)
}
export async function connectFixture(options={}){
  configureFixture();await mongoose.connect(uri,{autoCreate:false,autoIndex:false,serverSelectionTimeoutMS:3000,...options})
  assert.equal(mongoose.connection.host,'127.0.0.1');assert.equal(mongoose.connection.name,database)
  return mongoose.connection.db
}
export async function seedFixture(){
  const db=await connectFixture(),now=new Date('2026-11-02T00:00:00Z')
  const {notebookDerived}=await import('../../server/lib/notebook-derived.ts')
  const entries=Array.from({length:fixture.notebookEntries},(_,n)=>{
    const section=n<2400?'journal':'story-items',session=n<1200,kind=session?'sessions':section==='story-items'?'objects':['people','places','quests','factions'][n%4]
    const row={_id:oid(n+100),roomId:ids.room,kind:'entry',section,codexType:n%13===0?null:kind,title:session?`Session ${String(n+1).padStart(4,'0')}`:`${['Árvíz','Család','Csillag','Duna','Zár'][n%5]} ${String(n).padStart(4,'0')}`,body:`Description ${n} ${'Synthetic prose. '.repeat(95)}\n\n## Session sources\n- ${session?n+1:7}. session.`,questClues:kind==='quests'?[{id:'00000000-0000-4000-8000-000000000001',title:'Private clue',body:'Not in lists',sessions:[],audience:'dm'}]:[],folderId:n%3===0?ids.folder:null,parentId:null,audience:['dm','room','characters','characters'][n%4],characterIds:n%4===2?[ids.character]:n%4===3?[ids.foreignCharacter]:[],relevantCharacterIds:[ids.character],relatedIds:[],revision:1,deletedAt:n%29===0?now:null,editedBy:'Fixture DM',createdBy:ids.owner,createdAt:now,updatedAt:now,tags:n%2?['City','Plot']:['Plot'],coverImage:'',gallery:[]}
    return {...row,listing:notebookDerived(row)}
  })
  const replace=async(name,rows)=>db.collection(name).bulkWrite(rows.map(row=>({replaceOne:{filter:{_id:row._id},replacement:row,upsert:true}})))
  await replace('users',[ids.owner,ids.player,ids.other].map((_id,n)=>({_id,email:`fixture-${n}@example.test`,displayName:['Fixture DM','Fixture player','Other player'][n]})))
  await replace('rooms',[{_id:ids.room,ownerId:ids.owner,name:'Synthetic notebook room',members:[ids.player,ids.other],assignments:[{characterId:ids.character,userId:ids.player},{characterId:ids.foreignCharacter,userId:ids.other}],notebookTagCatalog:[{key:'unused',name:'Unused'}]}])
  await replace('characters',[{_id:ids.character,userId:ids.owner,meta:{name:'Fixture character'}},{_id:ids.foreignCharacter,userId:ids.owner,meta:{name:'Other character'}}])
  await replace('notebooks',[{_id:ids.folder,roomId:ids.room,kind:'folder',section:'journal',title:'Folder',parentId:null,characterIds:[],audience:'room',revision:1,deletedAt:null,updatedAt:now},...entries])
  const {certifyNotebookRoom}=await import('../../server/lib/notebook-backfill.ts')
  assert.equal((await certifyNotebookRoom(db.collection('notebooks'),db.collection('rooms'),ids.room)).ready,true)
  const packs=[ids.owner,ids.player].flatMap((userId,actor)=>Array.from({length:fixture.packsPerOwner},(_,p)=>{
    const source=`{:orcpub.dnd.e5/feats {${Array.from({length:25},(_,n)=>`:fixture-${p}-${n} {:name "Fixture ${p} ${n}" :description "${'Synthetic definition. '.repeat(30)}"}`).join(' ')}}}`
    return {_id:oid(10000+actor*1000+p),userId,type:'orcbrew',sourceHash:createHash('sha256').update(source).digest('hex'),updatedAt:now,data:{filename:`fixture-${p}.orcbrew`,source,includeDisabled:false}}
  }))
  await replace('customcontents',packs)
  const {Notebook}=await import('../../server/models/Notebook.ts')
  const {CompendiumBrowseIndex}=await import('../../server/models/CompendiumBrowseIndex.ts')
  const {CompendiumEntryCache}=await import('../../server/models/CompendiumEntryCache.ts')
  for(const model of [Notebook,CompendiumBrowseIndex,CompendiumEntryCache])for(const [key,options]of model.schema.indexes())await db.collection(model.collection.name).createIndex(key,options)
  await db.collection('characters').createIndex({userId:1})
  await db.collection('customcontents').createIndex({userId:1,type:1})
  assert.equal(await db.collection('notebooks').countDocuments({roomId:ids.room,kind:'entry'}),fixture.notebookEntries)
  return {scope:'Synthetic local fixture only; database and seed retained',database,...fixture}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){try{console.log(JSON.stringify(await seedFixture()))}finally{await mongoose.disconnect()}}
