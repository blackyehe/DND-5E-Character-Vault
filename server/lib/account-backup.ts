import mongoose,{mongo,Types} from 'mongoose'
import {randomBytes,createHash} from 'node:crypto'
import {gzipSync,gunzipSync} from 'node:zlib'
import {Character} from '../models/Character'
import {CustomContent} from '../models/CustomContent'
import {CharacterLibrary} from '../models/CharacterLibrary'
import {Room} from '../models/Room'
import {Notebook,NotebookRevision} from '../models/Notebook'
import {RoomMap,MapAsset,MapQuota} from '../models/RoomMap'
import {CityLibrary} from '../models/CityLibrary'
import {notebookDerived,NOTEBOOK_LISTING_VERSION} from './notebook-derived'
import {reserveMapStorage} from './map-storage'
import {RoomLibraryError} from './room-library-access'
import {packSource,storedPackData} from './pack-storage'
import {inspectOrcbrew,sourceHash} from './orcbrew'
import {MAP_LIMITS,MAP_OVERVIEW_EDGES} from '../../shared/room-maps'
import {regionProblem} from '../../shared/map-regions'
import {CITY_LIMITS} from '../../shared/map-city-library'
import {isNotebookCover} from '../../shared/notebook-cover'
import {isNotebookArtwork,NOTEBOOK_GALLERY_LIMIT} from '../../shared/notebook-gallery'
import {applyLibraryAction,type CharacterLibrary as FolderLibrary} from '../../shared/character-library'
import {BACKUP_FORMAT,BACKUP_VERSION,BACKUP_FILE_BYTES,BACKUP_EXPANDED_BYTES,remapBackupReferences,type AccountBackup,type BackupSummary} from '../../shared/account-backup'

type Row=Record<string,any>
interface Payload {accountId:any;characters:Row[];content:Row[];characterLibrary:Row|null;rooms:Row[];notes:Row[];history:Row[];maps:Row[];assets:Row[];cities:Row[]}
export class BackupError extends Error{status:number;constructor(status:number,message:string){super(message);this.status=status}}
const fail=(message:string,status=400):never=>{throw new BackupError(status,message)}
const oid=(value:unknown)=>{const s=String(value??'');if(!/^[a-f0-9]{24}$/i.test(s))return fail('The backup contains an invalid record reference.');return s.toLowerCase()}
const limits={characters:1000,content:5000,rooms:200,notes:20000,history:100000,maps:5000,assets:5000,cities:20000} as const
function summary(p:Payload):BackupSummary{return{characters:p.characters.length,content:p.content.length,rooms:p.rooms.length,notes:p.notes.length,history:p.history.length,maps:p.maps.length,cities:p.cities.length,characterFolders:p.characterLibrary?.folders?.length??0}}

/** All reads share one snapshot, including edits made by other room members. */
export async function createAccountBackup(owner:string):Promise<AccountBackup>{
  const session=await mongoose.startSession();let payload!:Payload
  try{await session.withTransaction(async()=>{
    const characters=await Character.find({userId:owner}).session(session).lean(),content=await CustomContent.find({userId:owner}).session(session).lean(),characterLibrary=await CharacterLibrary.findOne({ownerId:owner}).session(session).lean(),rooms=await Room.find({ownerId:owner}).session(session).lean()
    const roomIds=rooms.map(r=>r._id),notes=await Notebook.find({roomId:{$in:roomIds}}).session(session).lean(),history=await NotebookRevision.find({roomId:{$in:roomIds}}).session(session).lean(),maps=await RoomMap.find({roomId:{$in:roomIds}}).session(session).lean(),assets=await MapAsset.find({roomId:{$in:roomIds}}).session(session).lean(),cities=await CityLibrary.find({roomId:{$in:roomIds}}).session(session).lean()
    payload={accountId:new Types.ObjectId(owner),characters,content,characterLibrary,rooms:rooms.map(({joinToken:_token,...room})=>room),notes,history,maps,assets,cities}
  },{readConcern:{level:'snapshot'},maxCommitTimeMS:10000})}finally{await session.endSession()}
  for(const [key,max]of Object.entries(limits))if(payload[key as keyof typeof limits].length>max)fail('This account exceeds the portable backup record limit.',413)
  const bytes=Buffer.from(mongo.BSON.EJSON.stringify(payload,{relaxed:true}));if(bytes.length>BACKUP_EXPANDED_BYTES)fail('This account exceeds the 256 MiB portable backup limit.',413)
  const backup:AccountBackup={format:BACKUP_FORMAT,version:BACKUP_VERSION,encoding:'gzip-base64',sha256:createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,createdAt:new Date().toISOString(),summary:summary(payload),payload:gzipSync(bytes).toString('base64')}
  if(Buffer.byteLength(JSON.stringify(backup))>BACKUP_FILE_BYTES-1024*1024)fail('The compressed backup exceeds the 50 MiB restore limit.',413)
  return backup
}
export function decodeAccountBackup(value:unknown):Payload{
  const b=value as AccountBackup
  if(!b||b.format!==BACKUP_FORMAT||b.version!==2||b.encoding!=='gzip-base64'||!Number.isSafeInteger(b.bytes)||b.bytes<1||b.bytes>BACKUP_EXPANDED_BYTES||typeof b.payload!=='string'||b.payload.length>BACKUP_FILE_BYTES||b.payload.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(b.payload)||!(/^[a-f0-9]{64}$/.test(b.sha256)))return fail('Choose a complete version 2 Codex backup.')
  let p:Payload
  try{const packed=Buffer.from(b.payload,'base64'),bytes=gunzipSync(packed,{maxOutputLength:BACKUP_EXPANDED_BYTES});if(packed.toString('base64')!==b.payload||bytes.length!==b.bytes||createHash('sha256').update(bytes).digest('hex')!==b.sha256)throw Error();p=mongo.BSON.EJSON.parse(bytes.toString('utf8'),{relaxed:true}) as Payload}catch{return fail('The backup is damaged or its checksum does not match. No data was imported.')}
  for(const [key,max]of Object.entries(limits)){if(!Array.isArray(p[key as keyof typeof limits])||p[key as keyof typeof limits].length>max)return fail('The backup has missing or excessive records.')}
  oid(p.accountId)
  if(p.characterLibrary!==null&&(!p.characterLibrary||typeof p.characterLibrary!=='object'))return fail('Invalid character folders.')
  if(!b.summary||Object.entries(summary(p)).some(([key,count])=>b.summary[key as keyof BackupSummary]!==count))return fail('The backup counts do not match its contents.')
  return p
}
function validateGraph(p:Payload){
  const sets=new Map<string,Map<string,Row>>()
  for(const key of Object.keys(limits) as (keyof typeof limits)[]){const set=new Map<string,Row>();for(const r of p[key]){if(!r||typeof r!=='object')fail('Invalid backup record.');const id=oid(r._id);if(set.has(id))fail('The backup contains duplicate record IDs.');set.set(id,r)}sets.set(key,set)}
  const rooms=sets.get('rooms')!,notes=sets.get('notes')!,maps=sets.get('maps')!
  for(const key of ['notes','history','maps','assets','cities'] as const)for(const r of p[key])if(!rooms.has(oid(r.roomId)))fail('A campaign record refers to a room outside this backup.')
  for(const key of ['history','cities'] as const)for(const r of p[key]){const entry=notes.get(oid(r.entryId));if(!entry||oid(entry.roomId)!==oid(r.roomId))fail('A history or city record refers to a missing note.')}
  for(const h of p.history)if(!h.snapshot||oid(h.snapshot._id)!==oid(h.entryId)||oid(h.snapshot.roomId)!==oid(h.roomId))fail('A history snapshot belongs to another note or room.')
  for(const a of p.assets){const m=maps.get(oid(a._id));if(!m||oid(m.roomId)!==oid(a.roomId))fail('An image belongs to a missing map.')}
  if(p.assets.length!==p.maps.length)fail('A map image is missing from the backup.')
  for(const n of p.notes){for(const key of ['folderId','parentId',...(n.relatedIds?['relatedIds']:[])] as const){const refs=Array.isArray(n[key])?n[key]:n[key]?[n[key]]:[];for(const ref of refs){const target=notes.get(oid(ref));if(target&&oid(target.roomId)!==oid(n.roomId))fail('A note link crosses campaign boundaries.')}}}
  for(const m of p.maps)for(const pin of m.pins??[]){const target=notes.get(oid(pin.entryId));if(target&&oid(target.roomId)!==oid(m.roomId))fail('A map pin crosses campaign boundaries.')}
  for(const c of p.cities)for(const snapshot of [c,c.previous].filter(Boolean))for(const e of snapshot.entries??[]){const target=notes.get(oid(e.entryId));if(target&&oid(target.roomId)!==oid(c.roomId))fail('A city link crosses campaign boundaries.')}
}
function collectIds(value:any,ids:Map<string,string>,key=''){
  const reference=/^(?:roomId|entryId|characterId|characterIds|relevantCharacterIds|relatedIds|folderId|parentId|templateId|packId)$/
  if(value instanceof Types.ObjectId){const id=oid(value);if(reference.test(key)&&!ids.has(id))ids.set(id,new Types.ObjectId().toString());return}
  if(value instanceof Date||value instanceof mongo.Binary||Buffer.isBuffer(value))return
  if(Array.isArray(value)){for(const v of value)collectIds(v,ids,key);return}
  if(value&&typeof value==='object'){for(const [k,v]of Object.entries(value))collectIds(v,ids,k);return}
  if(typeof value==='string'&&reference.test(key)&&/^[a-f0-9]{24}$/i.test(value)&&!ids.has(value))ids.set(value,new Types.ObjectId().toString())
}
const cloneRemap=(value:any,ids:Map<string,string>,noteText=false)=>mongo.BSON.EJSON.deserialize(remapBackupReferences(mongo.BSON.EJSON.serialize(value,{relaxed:true}),ids,noteText),{relaxed:true}) as Row
async function validated(model:mongoose.Model<any>,values:Row[]){const out:Row[]=[];for(const value of values){const doc=new model(value);await doc.validate();out.push(doc.toObject())}return out}
function binary(value:any){if(value instanceof mongo.Binary)return Buffer.from(value.value());if(Buffer.isBuffer(value))return value;return fail('A map image has invalid binary data.')}
async function validateImages(p:Payload){
  const {default:sharp}=await import('sharp')
  const image=async(bytes:Buffer,edge:number)=>{if(!bytes.length||bytes.length>MAP_LIMITS.imageBytes)fail('A map image exceeds its size limit.');const s=sharp(bytes,{limitInputPixels:MAP_LIMITS.inputPixels,failOn:'warning'}),meta=await s.metadata();if(meta.format!=='webp'||(meta.pages??1)>1||!meta.width||!meta.height||Math.max(meta.width,meta.height)>edge)fail('A map image is invalid or too large.');await s.stats();return{width:meta.width!,height:meta.height!}}
  for(const asset of p.assets){const map=p.maps.find(m=>String(m._id)===String(asset._id))!,data=binary(asset.data),meta=await image(data,MAP_LIMITS.dimension);if(map.width!==meta.width||map.height!==meta.height||map.bytes!==data.length)fail('Map image metadata does not match its bytes.')
    const variants:Row[]=[];let storage=data.length;const seen=new Set<number>()
    for(const v of asset.overviews??[]){if(!MAP_OVERVIEW_EDGES.includes(v.edge)||seen.has(v.edge))fail('Invalid map overview.');seen.add(v.edge);const bytes=binary(v.data),size=await image(bytes,v.edge);storage+=bytes.length;variants.push({edge:v.edge,...size,bytes:bytes.length})}
    if((map.imageVariants??[]).length!==variants.length||variants.some(v=>!(map.imageVariants??[]).some((stored:Row)=>['edge','width','height','bytes'].every(k=>stored[k]===v[k]))))fail('Map overview metadata does not match its bytes.');map.storageBytes=storage
  }
}
async function prepareAccountRestore(owner:string,input:unknown){
  const original=decodeAccountBackup(input);validateGraph(original)
  const ids=new Map<string,string>([[oid(original.accountId),owner]])
  for(const key of Object.keys(limits) as (keyof typeof limits)[])for(const row of original[key]){const id=oid(row._id);if(!ids.has(id))ids.set(id,new Types.ObjectId().toString())}
  if(original.characterLibrary?._id)ids.set(oid(original.characterLibrary._id),new Types.ObjectId().toString())
  // Subdocument IDs stay stable: they are scoped to their parent, and saved
  // play-state references can contain them. Only stored records need new IDs.
  collectIds(original,ids)
  const p=cloneRemap(original,ids) as Payload;p.notes=original.notes.map(n=>cloneRemap(n,ids,true));p.history=original.history.map(h=>cloneRemap(h,ids,true))
  for(const c of p.characters)c.userId=owner
  for(const c of p.content){c.userId=owner;if(c.type==='orcbrew'){const source=packSource(c.data),parsed=inspectOrcbrew(source);c.data=storedPackData(c.data,{report:parsed.report});c.sourceHash=sourceHash(source)}}
  for(const room of p.rooms){room.ownerId=owner;room.members=[];room.assignments=[];room.joinToken=randomBytes(32).toString('base64url');room.notebookListingVersion=NOTEBOOK_LISTING_VERSION;room.notebookChanges={}}
  for(const note of p.notes){if(!Number.isSafeInteger(note.revision)||note.revision<1||!isNotebookCover(note.coverImage??'')||(note.gallery?.length??0)>NOTEBOOK_GALLERY_LIMIT||(note.gallery??[]).some((art:Row)=>!isNotebookArtwork(art.image)))fail('Invalid notebook revision or artwork.');note.listing=notebookDerived(note as any)}
  for(const map of p.maps){map.ownerId=owner;if((map.pins?.length??0)>MAP_LIMITS.pinsPerMap||(map.regions?.length??0)>MAP_LIMITS.regionsPerMap)fail('A map exceeds its pin or region limit.');for(const r of map.regions??[])if(regionProblem(r.points)||!/^#[0-9a-f]{6}$/i.test(r.color))fail('Invalid map region.')}
  for(const city of p.cities)for(const v of [city,city.previous].filter(Boolean))if(!Array.isArray(v.categories)||v.categories.length>CITY_LIMITS.categories||new Set(v.categories).size!==v.categories.length||(v.entries?.length??0)>CITY_LIMITS.entries||v.entries.some((e:Row)=>!v.categories.includes(e.category)))fail('Invalid city library.')
  await validateImages(p)
  const library=p.characterLibrary??{folders:[],placements:[],revision:0};library.ownerId=owner
  applyLibraryAction(library as FolderLibrary,{type:'move',characterIds:[],folderId:null})
  for(const f of library.folders??[])applyLibraryAction(library as FolderLibrary,{type:'rename',folderId:f.id,name:f.name})
  // Deleting a character can leave an old placement. Keep it unavailable under
  // its remapped ID rather than attaching it to an existing foreign character.
  if((library.placements??[]).some((x:Row)=>!library.folders.some((f:Row)=>f.id===x.folderId)))fail('Invalid character folder placement.')
  const models=[Character,CustomContent,Room,Notebook,NotebookRevision,RoomMap,MapAsset,CityLibrary] as mongoose.Model<any>[]
  const lists=await Promise.all(models.map((model,i)=>validated(model,[p.characters,p.content,p.rooms,p.notes,p.history,p.maps,p.assets,p.cities][i]!)))
  const [lib]=await validated(CharacterLibrary,[library])
  return{original,p,ids,models,lists,lib}
}
export async function restoreAccountBackup(owner:string,input:unknown){
  let prepared:Awaited<ReturnType<typeof prepareAccountRestore>>
  try{prepared=await prepareAccountRestore(owner,input)}catch(e){if(e instanceof BackupError)throw e;return fail('The backup contains invalid campaign, character, image or library data. No data was imported.')}
  const {original,p,ids,models,lists,lib}=prepared
  // Existing production collections already exist; this also supports an empty installation.
  for(const model of [...models,CharacterLibrary,MapQuota] as mongoose.Model<any>[]){await model.createCollection();await model.createIndexes()}
  const session=await mongoose.startSession()
  try{await session.withTransaction(async()=>{
    if(await Character.exists({userId:owner}).session(session)||await CustomContent.exists({userId:owner}).session(session)||await Room.exists({ownerId:owner}).session(session))fail('Restore into an empty account so existing data is never overwritten.',409)
    const old=await CharacterLibrary.findOne({ownerId:owner}).session(session).lean();if(old&&(old.folders.length||old.placements.length))fail('Restore into an account with no existing character folders.',409)
    if(old){await CharacterLibrary.updateOne({_id:old._id},{$set:{folders:lib!.folders,placements:lib!.placements},$inc:{revision:1}},{session})}else await CharacterLibrary.collection.insertOne(lib! as any,{session})
    for(const map of p.maps)await reserveMapStorage(owner,map.roomId,map.storageBytes!,session)
    // Model.insertMany resets __v to zero; validated raw inserts preserve saved
    // action/item revisions as well as original timestamps and identity links.
    for(let i=0;i<models.length;i++)if(lists[i]!.length)await models[i]!.collection.insertMany(lists[i]! as any[],{session})
  })}catch(e){if(e instanceof RoomLibraryError)throw new BackupError(e.status,e.message);if((e as {code?:number}).code===11000)fail('Another restore or conflicting record already exists. No data was imported.',409);throw e}finally{await session.endSession()}
  const refs=Object.fromEntries([...original.characters,...original.content].map(r=>[oid(r._id),ids.get(oid(r._id))!]))
  return{...summary(original),idMap:refs,playersMustRejoin:true}
}
