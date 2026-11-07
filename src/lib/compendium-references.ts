import type {InjectionKey,ShallowRef} from 'vue'
import {api} from './api'
import {LOCAL_COMPENDIUM_VERSION,localIndexDigest,validLocalBrowseIndex,type LocalCompendiumSnapshot} from '../../shared/local-compendium'
import {readingKey} from './compendium-reading'
import {spellLevelGroups} from './spell-level-groups'
import {spellReferenceLabel} from './spell-reference'

export interface ReadingSpell {index:string;name:string;source:string;level?:number}
export interface SpellReferenceContext {names:ShallowRef<Map<string,ReadingSpell>>;ensure:()=>Promise<void>}
export const SPELL_REFERENCE_CONTEXT:InjectionKey<SpellReferenceContext>=Symbol('Compendium spell names')
export const referenceKey=(key:string)=>key.replace(/^:/,'').split('/').pop()!
const spellLevelMapFields=['spell-list','warlock-spells','cleric-spells','wizard-spells','druid-spells','paladin-spells','ranger-spells']
const spellFields=new Set([...spellLevelMapFields,'spell-list-kw','known-spells','prepared-spells','spell-reference'])
function spellReferenceEntries(value:unknown,key:string):{index:string;level?:number}[]|null{
 const typed=spellFields.has(readingKey(key))
 const values=typeof value==='string'?[value]:Array.isArray(value)?value:null
 if(values?.length&&values.every((v):v is string=>typeof v==='string'))return typed||values.some(v=>/^homebrew-spells-[a-f0-9]{32}$/i.test(v))?values.map(index=>({index})):null
 if(!spellLevelMapFields.includes(readingKey(key))||!value||typeof value!=='object'||Array.isArray(value))return null
 const pairs=Object.entries(value);if(!pairs.length||!pairs.every(([level])=>/^:?[0-9]$/.test(level)))return null
 const result:{index:string;level:number}[]=[]
 for(const [level,group]of pairs){
  const slots=group&&typeof group==='object'&&!Array.isArray(group)?Object.entries(group):null
  const rows=typeof group==='string'?[group]:Array.isArray(group)?group:slots?.every(([slot,v])=>/^:?\d+$/.test(slot)&&typeof v==='string')?slots.map(([,v])=>v):null
  if(!rows||!rows.every((v):v is string=>typeof v==='string'))return null
  result.push(...rows.map(index=>({index,level:Number(level.replace(/^:/,''))})))
 }
 return result
}
export const spellReferences=(value:unknown,key:string)=>spellReferenceEntries(value,key)?.map(row=>row.index)??null
export function declaredSpellLevels(value:unknown,key:string){
 const result:Record<string,number>={},ambiguous=new Set<string>()
 for(const row of spellReferenceEntries(value,key)??[])if(row.level!==undefined){const id=referenceKey(row.index);if(ambiguous.has(id))continue;if(result[id]!==undefined&&result[id]!==row.level){delete result[id];ambiguous.add(id)}else result[id]=row.level}
 return result
}
export function groupedReadingSpells(indexes:readonly string[],names:Map<string,ReadingSpell>,declared:Record<string,number>={}){
 return spellLevelGroups(indexes.map(index=>{const key=referenceKey(index),spell=names.get(key);return {index,spell,name:spell?.name??spellReferenceLabel(key),level:spell?.level??declared[key]}}))
}
/** Names and source metadata only, from the existing authenticated category export. */
export async function loadReadingSpellNames(owner:string,signal:AbortSignal){
 const snapshot=await api.get<LocalCompendiumSnapshot>('/api/compendium-browse/spells/local-index',{timeoutMs:60000,signal})
 if(snapshot.owner!==owner||snapshot.kind!=='spells'||snapshot.version!==LOCAL_COMPENDIUM_VERSION||typeof snapshot.payload!=='string'||await localIndexDigest(snapshot.payload)!==snapshot.digest)throw Error('Spell names could not be verified.')
 const index:unknown=JSON.parse(snapshot.payload)
 if(!validLocalBrowseIndex(index))throw Error('Spell names could not be read.')
 const names=new Map<string,ReadingSpell>(),aliases=new Map<string,ReadingSpell>(),ambiguous=new Set<string>()
 for(const row of index.records){const level=row.facts.level?.[0];names.set(row.entry.index,{index:row.entry.index,name:String(row.entry.displayName||row.entry.name),source:row.entry.sourcePack||'SRD 2014',...level!==undefined&&/^[0-9]$/.test(level)?{level:Number(level)}:{}})}
 for(const row of index.records){
  const value=names.get(row.entry.index)!
  for(const raw of [row.entry.contentKey,...Array.isArray(row.entry.aliases)?row.entry.aliases:[]])if(typeof raw==='string'){
   const key=referenceKey(raw);if(names.has(key)||ambiguous.has(key))continue
   if(aliases.has(key)&&aliases.get(key)!.index!==value.index){aliases.delete(key);ambiguous.add(key)}else aliases.set(key,value)
  }
 }
 for(const [key,value]of aliases)names.set(key,value)
 return names
}
