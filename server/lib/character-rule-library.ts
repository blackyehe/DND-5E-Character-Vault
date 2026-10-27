import {CustomContent} from '../models/CustomContent'
import {env} from '../env'
import {sourceHash,buildOrcbrewCatalog} from './orcbrew'
import {characterRules,CHARACTER_RULE_KINDS,type CharacterRuleLibrary} from './workshop-rules'
import {workshopLibrary,workshopRevision,warmWorkshopRules} from './workshop-library'

const libraries=new Map<string,{signature:string;value:CharacterRuleLibrary;bytes:number}>()
const pending=new Map<string,Promise<CharacterRuleLibrary>>()
let retainedBytes=0
const MAX_RETAINED_BYTES=32*1024*1024
const enabledOwners=new Set(env.COMPENDIUM_PREPARED_USERS.split(',').map(s=>s.trim()).filter(Boolean))

function remember(userId:string,signature:string,value:CharacterRuleLibrary){
  // Measured once on build, never on the warm path. Derived data is bounded
  // independently of the original full-library cache and contains no raw packs.
  const bytes=Buffer.byteLength(JSON.stringify(value))
  if(bytes>MAX_RETAINED_BYTES)return
  const old=libraries.get(userId)
  if(old){retainedBytes-=old.bytes;libraries.delete(userId)}
  while(libraries.size&&(libraries.size>=4||retainedBytes+bytes>MAX_RETAINED_BYTES)){
    const key=libraries.keys().next().value!
    retainedBytes-=libraries.get(key)!.bytes;libraries.delete(key)
  }
  libraries.set(userId,{signature,value,bytes});retainedBytes+=bytes
}

/** Character play needs full rule definitions, not monsters, items or raw pack
 * trees. Default/rollback uses the original library. Authoring stays on that
 * library explicitly; no partial result is typed as a full WorkshopLibrary. */
export async function characterRuleLibrary(userId:string|undefined):Promise<CharacterRuleLibrary>{
  if(!userId||env.COMPENDIUM_READER!=='prepared'||(!enabledOwners.has('*')&&!enabledOwners.has(userId)))return workshopLibrary(userId)
  const active=pending.get(userId);if(active)return active
  const task=(async()=>{
    // Same authoritative small revision query as the original warm library.
    const revisions=await CustomContent.find({userId,type:'orcbrew'}).select('_id updatedAt sourceHash data.includeDisabled').sort({_id:1}).lean()
    const signature=JSON.stringify(revisions),cached=libraries.get(userId)
    if(cached?.signature===signature){libraries.delete(userId);libraries.set(userId,cached);return cached.value}
    const full=warmWorkshopRules(userId,signature)
    if(full)return full
    try{
      const {componentMetadata,readComponentCatalogues}=await import('./compendium-components')
      const deadline=performance.now()+15000,metadata=await componentMetadata(userId,deadline)
      // All six categories in one bounded cursor; one shared repair budget.
      const packs=await readComponentCatalogues(userId,CHARACTER_RULE_KINDS,metadata,true,deadline)
      if(packs){
        const composed=buildOrcbrewCatalog(packs)
        const catalog=Object.fromEntries(CHARACTER_RULE_KINDS.map(kind=>[kind,composed[kind]])) as CharacterRuleLibrary['catalog']
        const value:CharacterRuleLibrary={catalog,...characterRules(catalog),warnings:[]}
        // Publish RAM only after proving the complete current pack set again.
        // A racing edit never relabels an old composition as the new revision.
        if(await workshopRevision(userId)===sourceHash(signature)){
          remember(userId,signature,value)
          return value
        }
      }
    }catch(error){
      console.warn('Character rule components unavailable; using current reader',{name:(error as Error).name})
    }
    return workshopLibrary(userId)
  })()
  pending.set(userId,task)
  try{return await task}finally{if(pending.get(userId)===task)pending.delete(userId)}
}
