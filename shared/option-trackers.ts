import type {Character,CharacterResource} from './character'
import type {CompendiumDefinition} from './compendium-editing'
import {isOptionKind} from './option-kinds'
import {benefitDefinitionLevel} from './rule-benefits'
import {optionHasId} from './option-reference'
import {featResourceKey} from './feat-resources'
import {reconcileItemTrackers,trackerProblems,type LinkedTracker} from './linked-trackers'

export type OptionTracker=Omit<LinkedTracker,'activation'>&{level:number}
export const OPTION_RESOURCE_PREFIX='linked:option:'
export const newOptionTracker=():OptionTracker=>({id:crypto.randomUUID(),name:'Uses',max:1,recovery:'long',level:1,notes:''})
export function optionTrackerProblems(value:unknown):string[]{
 if(value===undefined)return []
 if(!Array.isArray(value))return ['Use a list of linked trackers.']
 const issues=trackerProblems(value.map(t=>({...t,activation:'carried'})))
 if(issues.length)return issues
 return value.some(t=>!Number.isInteger(t.level)||t.level<1||t.level>20)?['Tracker unlock levels must be whole numbers from 1 to 20.']:[]
}
export const optionTrackers=(d:CompendiumDefinition):OptionTracker[]|undefined=>(d.entry.optionBuilder as {trackers?:OptionTracker[]}|undefined)?.trackers
export const optionTrackerKey=(d:CompendiumDefinition)=>`${d.kind}:${typeof d.entry.optionId==='string'?d.entry.optionId:d.index}`
type Context=Pick<Character,'meta'>&Partial<Pick<Character,'features'|'proficiencies'|'compendiumRules'|'resources'>>
function grantLevel(c:Context,d:CompendiumDefinition,owned=false){
 const character={...c,meta:{...c.meta,...(owned?{level:20}:{})},features:c.features??[],proficiencies:c.proficiencies??{languages:[]}} as Character
 return Math.max(benefitDefinitionLevel(character,d.kind,d.index,d.entry),benefitDefinitionLevel(character,d.kind,d.index,d.before))
}
export function optionTrackerResources(c:Context,includeInactive=false):CharacterResource[]{
 return (c.compendiumRules??[]).flatMap(d=>{
  const trackers=optionTrackers(d)
  if(!isOptionKind(d.kind)||!trackers||optionTrackerProblems(trackers).length||!grantLevel(c,d,true))return []
  const definitionKey=optionTrackerKey(d),level=grantLevel(c,d)
  return trackers.flatMap(t=>{
   if(!includeInactive&&(!level||level<t.level))return []
   const id=`${OPTION_RESOURCE_PREFIX}${definitionKey}:${t.id}`,used=c.resources?.find(r=>r.id===id)?.used??d.trackerUses?.[t.id]??0
   return [{id,name:`${String(d.entry.name)} · ${t.name}`,max:t.max,used:Number.isInteger(used)&&used>=0&&used<=999?used:0,recovery:t.recovery,automatic:true,notes:t.notes,source:{kind:'option' as const,definitionKey,trackerId:t.id}}]
  })
 })
}
/** Explicit definitions replace name-based automatic feat guesses, including []. */
export function authoredFeatTrackerKeys(c:Context){
 const keys=new Set<string>()
 for(const d of c.compendiumRules??[])if(d.kind==='feats'&&Array.isArray(optionTrackers(d))&&grantLevel(c,d,true)){
  keys.add(featResourceKey(String(d.entry.name)));keys.add(featResourceKey(String(d.before.name)))
  for(const f of c.features??[])if(f.definition?.kind==='feats'&&optionHasId({...d.entry,index:d.index,name:String(d.entry.name)},f.definition.index))keys.add(featResourceKey(f.name))
 }
 return keys
}
/** Item and option uses live with their source; derived rows are presentation. */
export function reconcileLinkedTrackers<T extends Pick<Character,'equipment'|'resources'|'meta'>&Partial<Pick<Character,'compendiumRules'|'features'|'proficiencies'>>>(c:T):T{
 const pools=optionTrackerResources(c,true),saved=c.resources??[],explicit=authoredFeatTrackerKeys(c)
 const definitions=c.compendiumRules?.map(d=>{
  if(optionTrackers(d)===undefined&&!d.trackerUses)return d
  const trackerUses:Record<string,number>={}
  for(const r of pools.filter(r=>r.source?.kind==='option'&&r.source.definitionKey===optionTrackerKey(d)))trackerUses[r.source!.trackerId]=r.used
  return {...d,trackerUses}
 })
 return reconcileItemTrackers({...c,...(definitions?{compendiumRules:definitions}:{}),...(c.resources?{resources:saved.filter(r=>!r.id.startsWith(OPTION_RESOURCE_PREFIX)&&!(r.automatic&&r.id.startsWith('auto:feat:')&&explicit.has(r.id.split(':')[2]!)))}:{})})
}
