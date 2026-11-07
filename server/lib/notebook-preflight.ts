import mongoose from 'mongoose'
import {notebookDerivedConsistent,NOTEBOOK_COLLATION,NOTEBOOK_LISTING_VERSION} from './notebook-derived'

export const NOTEBOOK_REQUIRED_INDEXES=[
 {name:'notebook_section_title_hu',key:{roomId:1,kind:1,section:1,deletedAt:1,title:1,_id:1}},
 {name:'notebook_title_hu',key:{roomId:1,kind:1,deletedAt:1,title:1,_id:1}},
 {name:'notebook_section_session_hu',key:{roomId:1,kind:1,section:1,deletedAt:1,'listing.type':1,'listing.firstSession':1,title:1,_id:1}},
 {name:'notebook_session_hu',key:{roomId:1,kind:1,deletedAt:1,'listing.type':1,'listing.firstSession':1,title:1,_id:1}},
 {name:'notebook_count_scope_hu',key:{roomId:1,kind:1,deletedAt:1,audience:1,characterIds:1,section:1,'listing.type':1}},
] as const
const projection={_id:1,ownerId:1,members:1,assignments:1,notebookListingVersion:1,notebookChanges:1}
export function notebookPlanSummary(value:unknown){
 const stages=new Set<string>(),indexes=new Set<string>()
 function visit(node:unknown){if(!node||typeof node!=='object')return;const r=node as Record<string,unknown>;if(typeof r.stage==='string')stages.add(r.stage);if(typeof r.indexName==='string')indexes.add(r.indexName);for(const[k,v]of Object.entries(r))if(k!=='rejectedPlans'&&k!=='allPlansExecution'&&v&&typeof v==='object')visit(v)}
 const explain=value as {queryPlanner?:{winningPlan?:unknown};executionStats?:{executionStages?:unknown;nReturned?:number;totalDocsExamined?:number;totalKeysExamined?:number;executionTimeMillis?:number}}
 visit(explain.queryPlanner?.winningPlan);visit(explain.executionStats?.executionStages)
 const stats=explain.executionStats
 return{blockingSort:stages.has('SORT'),indexes:[...indexes],returned:stats?.nReturned,docsExamined:stats?.totalDocsExamined,keysExamined:stats?.totalKeysExamined,executionMs:stats?.executionTimeMillis}
}
/** Raw-driver reads only: importing this module never initializes a model,
 * builds an index, certifies a room or writes derived metadata. */
export async function notebookPreflight(db:mongoose.mongo.Db,roomId:string,consistency=false){
 if(!/^[a-f\d]{24}$/i.test(roomId))throw Error('Choose one room for preflight.')
 const roomKey={_id:new mongoose.Types.ObjectId(roomId)},rooms=db.collection('rooms'),notes=db.collection('notebooks')
 const room=await rooms.findOne(roomKey,{projection,maxTimeMS:3000});if(!room)throw Error('Room not found.')
 const initial=JSON.stringify(room)
 const indexes=await notes.listIndexes({maxTimeMS:3000}).toArray()
 const indexChecks=NOTEBOOK_REQUIRED_INDEXES.map(expected=>{const actual=indexes.find(i=>i.name===expected.name),c=actual?.collation;return{name:expected.name,present:!!actual,exact:!!actual&&!actual.hidden&&!actual.sparse&&!actual.unique&&!actual.partialFilterExpression&&JSON.stringify(actual.key)===JSON.stringify(expected.key)&&c?.locale===NOTEBOOK_COLLATION.locale&&(c.strength??3)===3&&!c.caseLevel&&!c.numericOrdering&&(c.caseFirst??'off')==='off'&&(c.alternate??'non-ignorable')==='non-ignorable'&&!c.backwards&&!c.normalization}})
 const base={roomId:room._id,kind:'entry'},[counts]=await notes.aggregate< {total:number;unprepared:number} >([
  {$match:base},{$group:{_id:null,total:{$sum:1},unprepared:{$sum:{$cond:[{$or:[{$ne:[{$ifNull:['$listing.version',null]},NOTEBOOK_LISTING_VERSION]},{$ne:[{$ifNull:['$listing.sourceRevision',null]},'$revision']}]},1,0]}}}},
 ],{maxTimeMS:3000}).toArray()
 let scan:{requested:boolean;complete:boolean;scanned:number;invalid:number;sourceBytes:number}={requested:consistency,complete:false,scanned:0,invalid:0,sourceBytes:0}
 if(consistency&&(counts?.total??0)<=5000){
  const cursor=notes.find(base,{projection:{revision:1,section:1,title:1,body:1,codexType:1,showInEvents:1,questStatus:1,tags:1,listing:1},batchSize:50,maxTimeMS:10000})
  let bounded=false
  try{for await(const row of cursor){scan.sourceBytes+=Buffer.byteLength(String(row.body??''));if(scan.sourceBytes>64*1024*1024||scan.scanned>=5000){bounded=true;break}scan.scanned++;try{if(!notebookDerivedConsistent(row as unknown as Parameters<typeof notebookDerivedConsistent>[0]))scan.invalid++}catch{scan.invalid++}}}finally{await cursor.close()}
  scan.complete=!bounded&&scan.scanned===(counts?.total??0)
 }
 const plans:Record<string,unknown>[]=[]
 if(indexChecks.every(i=>i.exact)&&!(counts?.unprepared??0)&&scan.complete&&!scan.invalid){
  const scopes:[string,Record<string,unknown>][]=[['DM',{}]]
  const members=new Set((room.members??[]).map(String)),assignments=(room.assignments??[]) as {userId:mongoose.Types.ObjectId;characterId:mongoose.Types.ObjectId}[]
  const assigned=assignments.filter(a=>members.has(String(a.userId))),ids=assigned.map(a=>a.characterId)
  const owned=await db.collection('characters').find({_id:{$in:ids},userId:room.ownerId},{projection:{_id:1},maxTimeMS:3000}).toArray(),valid=new Set(owned.map(c=>String(c._id)))
  const groups=new Map<string,mongoose.Types.ObjectId[]>()
  for(const a of assigned)if(valid.has(String(a.characterId))){const key=String(a.userId),list=groups.get(key)??[];list.push(a.characterId);groups.set(key,list)}
  const largest=[...groups.values()].sort((a,b)=>b.length-a.length)[0]
  if(largest?.length)scopes.push(['player',{$or:[{audience:'room'},{audience:'characters',characterIds:{$in:largest}}]}])
  for(const[role,scope]of scopes)for(const section of ['all','journal','story-items'])for(const sessions of [false,true])for(const offset of [0,360]){
   const filter={...base,...scope,deletedAt:null,...section==='all'?{}:{section},...sessions?{'listing.type':'sessions'}:{}}
   const sort:Record<string,1>=sessions?{'listing.firstSession':1,title:1,_id:1}:{title:1,_id:1}
   const plan=await notes.find(filter,{projection:{_id:1,title:1,listing:1},maxTimeMS:3000,comment:'notebook-readonly-preflight'}).collation(NOTEBOOK_COLLATION).sort(sort).skip(offset).limit(60).explain('executionStats')
   plans.push({role,section,order:sessions?'sessions':'alphabetical',offset,...notebookPlanSummary(plan)})
  }
 }
 const unchanged=JSON.stringify(await rooms.findOne(roomKey,{projection,maxTimeMS:3000}))===initial
 return{readOnly:true,version:NOTEBOOK_LISTING_VERSION,roomCertified:room.notebookListingVersion===NOTEBOOK_LISTING_VERSION,counts:counts??{total:0,unprepared:0},indexes:indexChecks,consistency:scan,roomScopeUnchanged:unchanged,plans,planCheckSkipped:plans.length?undefined:'Requires exact indexes and a complete consistent scan first.',cloudMetadata:'Atlas tier, region, capacity and writer drain still require independent verification.',doesNotCertifyOrEnable:true}
}
