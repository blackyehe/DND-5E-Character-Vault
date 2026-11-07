import {queryBrowseIndex,type BrowseIndex,type BrowseKind,type BrowseQuery} from '../../shared/compendium-browse'
import {LOCAL_CATEGORY_BYTES,LOCAL_COMPENDIUM_VERSION,localIndexDigest,validLocalBrowseIndex,type LocalCompendiumSnapshot,type StoredCompendiumSnapshot} from '../../shared/local-compendium'

export interface LocalIndexStorage {
 read(kind:BrowseKind):Promise<StoredCompendiumSnapshot|undefined>
 write(value:StoredCompendiumSnapshot):Promise<void|BrowseKind[]>
}
/** One parsed category per worker; no descriptions or character writes. */
export class LocalCompendiumEngine {
 storedKinds?:BrowseKind[]
 private current?:{snapshot:LocalCompendiumSnapshot;index:BrowseIndex;until:number}
 private storage:LocalIndexStorage
 constructor(storage:LocalIndexStorage){this.storage=storage}
 private async decode(snapshot:LocalCompendiumSnapshot,owner:string,kind:BrowseKind){
  if(!snapshot||snapshot.version!==LOCAL_COMPENDIUM_VERSION||snapshot.owner!==owner||snapshot.kind!==kind||!/^[a-f0-9]{64}$/.test(snapshot.revision)||!/^[a-f0-9]{64}$/.test(snapshot.digest)||typeof snapshot.payload!=='string')throw Error('Invalid local catalogue identity')
  const bytes=new TextEncoder().encode(snapshot.payload).length
  if(bytes>LOCAL_CATEGORY_BYTES||await localIndexDigest(snapshot.payload)!==snapshot.digest)throw Error('Invalid local catalogue checksum')
  const index:unknown=JSON.parse(snapshot.payload)
  if(!validLocalBrowseIndex(index))throw Error('Invalid local catalogue structure')
  return {snapshot,index,bytes}
 }
 async open(owner:string,kind:BrowseKind){
  if(this.current?.snapshot.owner===owner&&this.current.snapshot.kind===kind&&this.current.until>Date.now())return this.current.snapshot.revision
  this.current=undefined
  const stored=await this.storage.read(kind)
  if(!stored||!Number.isFinite(stored.savedAt)||stored.savedAt>Date.now()+60000||stored.savedAt<Date.now()-7*86400000)return null
  let decoded:Awaited<ReturnType<LocalCompendiumEngine['decode']>>
  try{decoded=await this.decode(stored,owner,kind)}catch{return null}
  this.current={...decoded,until:stored.savedAt+7*86400000}
  return stored.revision
 }
 async save(snapshot:LocalCompendiumSnapshot,owner:string,kind:BrowseKind){
  this.current=undefined
  const decoded=await this.decode(snapshot,owner,kind)
  const kinds=await this.storage.write({...snapshot,bytes:decoded.bytes,savedAt:Date.now()})
  this.storedKinds=Array.isArray(kinds)?kinds:undefined
  this.current={...decoded,until:Date.now()+7*86400000}
  return snapshot.revision
 }
 async identity(owner:string,kind:BrowseKind){
  if(!await this.open(owner,kind))return null
  return {revision:this.current!.snapshot.revision,digest:this.current!.snapshot.digest}
 }
 async revalidate(owner:string,kind:BrowseKind,previous:string,digest:string,revision:string){
  this.current=undefined
  if(!/^[a-f0-9]{64}$/.test(revision))throw Error('Invalid revision')
  // Re-read and hash the disk value: another operation must never be relabelled
  // merely because an earlier in-memory category happened to have this digest.
  const stored=await this.storage.read(kind)
  if(!stored||stored.revision!==previous||stored.digest!==digest||!Number.isFinite(stored.savedAt)||stored.savedAt>Date.now()+60000||stored.savedAt<Date.now()-7*86400000)return null
  const decoded=await this.decode(stored,owner,kind)
  const kinds=await this.storage.write({...stored,revision,bytes:decoded.bytes})
  this.storedKinds=Array.isArray(kinds)?kinds:undefined
  // Preserve savedAt: verifying unchanged content does not reset the disk age.
  return revision
 }
 query(owner:string,kind:BrowseKind,revision:string,query:BrowseQuery){
  const current=this.current
  if(!current||current.snapshot.owner!==owner||current.snapshot.kind!==kind||current.snapshot.revision!==revision)throw Error('Local catalogue needs validation')
  return queryBrowseIndex(current.index,kind,query,revision)
 }
}
