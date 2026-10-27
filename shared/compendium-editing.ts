import { benefitProblems, entryBenefits } from './rule-benefits'
/** Personal definitions keep their original reference identity. */
export const EDITABLE_KINDS = ['spells','equipment','magic-items','classes','subclasses','races','subraces','monsters','backgrounds','feats','invocations','boons','selections','languages','other'] as const
export type CompendiumKind = typeof EDITABLE_KINDS[number]
export type EntryData = Record<string, unknown>
export interface CompendiumDefinition { kind: CompendiumKind; index: string; revision: number; sourceHash?: string; before: EntryData; entry: EntryData }
export interface CompendiumEditState {
  kind: CompendiumKind; index: string; revision: number; sourceHash: string; sourceChanged: boolean
  source: EntryData; entry: EntryData; edited: boolean
}
export const cloneEntry = <T>(value:T):T => JSON.parse(JSON.stringify(value))
export const sameEntry = (a:unknown,b:unknown):boolean => JSON.stringify(a)===JSON.stringify(b)
const protectedRoot = new Set(['index','contentKey','legacyKey','disabled','aliases','source','sourcePack','sourcePacks','sources','url','displayName','homebrew','filterFacets','workshopRevision','itemDetailUrl','monsterDetailUrl','definitionAvailable','monsterEnrichment','itemReference','itemDamageTypes'])
export function protectedEntryField(key:string,root=false):boolean {
  return ['__proto__','prototype','constructor','_id','id','localId','ruleId','featureId','index','url','key',':key','version','updatedAt','originalIndex','originalSelection',':edit-event',':option-pack',':codex/revision',':codex/previous-indexes',':codex/previous-names','published','imported','templateId','templateRevision','grantId'].includes(key) || root&&protectedRoot.has(key)
}
/** Reject dangerous keys, changed identities, type changes and excessive nesting. */
export function entryProblems(source:unknown,value:unknown,depth=0,root=true):string[] {
  if(root&&value&&typeof value==='object'&&'benefits' in value){const errors=benefitProblems((value as EntryData).benefits,entryBenefits(source));if(errors.length)return errors}
  if(depth>24)return ['The definition is nested too deeply.']
  if(typeof value==='number'&&!Number.isFinite(value))return ['Numbers must be finite.']
  if(source!==null&&source!==undefined&&value!==null&&typeof source!==typeof value)return ['Keep each field’s original value type.']
  if(Array.isArray(value)) {
    if(value.length>5000)return ['A list has too many entries.']
    if(source!==undefined&&!Array.isArray(source))return ['Keep each field’s original value type.']
    return value.flatMap((v,i)=>{
      const old=Array.isArray(source)?source:[],id=v&&typeof v==='object'?(v as EntryData).id??(v as EntryData)._id??(v as EntryData).index:undefined
      return entryProblems(id?old.find(x=>x&&typeof x==='object'&&((x as EntryData).id??(x as EntryData)._id??(x as EntryData).index)===id):old[i],v,depth+1,false)
    })
  }
  if(value&&typeof value==='object'){
    if(Array.isArray(source))return ['Keep each field’s original value type.']
    const before=(source&&typeof source==='object'?source:{}) as EntryData,after=value as EntryData
    return [...new Set([...Object.keys(before),...Object.keys(after)])].flatMap(key=>{
      if(['__proto__','prototype','constructor'].includes(key))return ['This field name is reserved.']
      if(source!==undefined&&protectedEntryField(key,root)&&!sameEntry(before[key],after[key]))return [`The source identity field ${key} cannot be changed.`]
      const derivedBuilder=root&&(after.spellBuilder&&['name','desc','higher_level','level','school','casting_time','range','duration','concentration','ritual','components','material','attack_type','classes','dc','damage','heal_at_slot_level','area_of_effect'].includes(key)||after.workshopItem&&['name','description','desc','weight','equipment_category','armor_class','damage','itemView'].includes(key)||after.optionBuilder&&['name','description','desc','prerequisites','feature','starting_equipment_description','script','type','typical_speakers','options','choose'].includes(key)||after.workshop&&['name','description','hit_die','homebrew_traits','traits','speed','size'].includes(key))
      const switchedBenefit=(key==='value'||key===':value')&&(before.type??before[':type'])!==(after.type??after[':type'])
      // Canonical benefits are editable rule payloads, including a granted spell's key.
      // Their schema is checked above; still traverse for reserved keys and size limits.
      return entryProblems(derivedBuilder||switchedBenefit||root&&['benefits','workshop','workshopItem','monsterDraft','spellBuilder','optionBuilder'].includes(key)?undefined:before[key],after[key],depth+1,false)
    })
  }
  if(typeof value==='string'&&value.length>200000)return ['A text field is too long.']
  return []
}
export function changedEntryFields(source:EntryData,entry:EntryData):EntryData {
  return Object.fromEntries(Object.entries(entry).filter(([key,value])=>!sameEntry(value,source[key])))
}
export function applyEntryChanges(source:EntryData,changes:EntryData):EntryData {
  return {...cloneEntry(source),...cloneEntry(changes)}
}
