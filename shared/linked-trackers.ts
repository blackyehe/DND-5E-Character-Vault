import type {Character,CharacterResource,EquipmentItem} from './character'

/** IDs are definition identities, independent of labels and array positions.
 * Later source types can reuse the definition and the resource source metadata. */
export interface LinkedTracker {id:string;name:string;max:number;recovery:'short'|'long'|'manual';activation:'carried'|'equipped'|'attuned';notes:string}
export const LINKED_RESOURCE_PREFIX='linked:item:'
export function trackerProblems(value:unknown):string[]{
 if(value===undefined)return []
 if(!Array.isArray(value)||value.length>20)return ['Use no more than 20 item trackers.']
 const ids=new Set<string>()
 for(const row of value){const t=row as LinkedTracker
  if(!t||typeof t!=='object'||typeof t.id!=='string'||! /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(t.id)||ids.has(t.id))return ['Each tracker needs its own permanent ID.']
  ids.add(t.id)
  if(typeof t.name!=='string'||!t.name.trim()||t.name.length>200||!Number.isInteger(t.max)||t.max<1||t.max>999||!['short','long','manual'].includes(t.recovery)||!['carried','equipped','attuned'].includes(t.activation)||typeof t.notes!=='string'||t.notes.length>10000)return ['Trackers need a name, 1–999 uses, valid recovery and availability, and notes up to 10,000 characters.']
 }
 return []
}
export const newLinkedTracker=():LinkedTracker=>({id:crypto.randomUUID(),name:'Uses',max:1,recovery:'long',activation:'carried',notes:''})
export function itemTrackerProblems(item:Pick<EquipmentItem,'trackers'|'requiresAttunement'>){
 const issues=trackerProblems(item.trackers)
 return issues.length?issues:!item.requiresAttunement&&item.trackers?.some(t=>t.activation==='attuned')?['Enable Requires attunement for an attuned-only tracker, or change its availability.']:[]
}
export const linkedItemResourceId=(item:EquipmentItem,tracker:LinkedTracker)=>`${LINKED_RESOURCE_PREFIX}${String(item._id??item.grantId??'')}:${tracker.id}`
export const isLinkedResource=(resource:Pick<CharacterResource,'id'>)=>resource.id.startsWith('linked:item:')||resource.id.startsWith('linked:option:')
export function trackerActive(item:EquipmentItem,tracker:LinkedTracker){
 if(item.qty<=0)return false
 if(tracker.activation==='carried')return true
 if(tracker.activation==='attuned')return !!item.requiresAttunement&&!!item.attuned
 return !!item.equipped&&(!item.requiresAttunement||!!item.attuned)
}
export function itemTrackerResources(c:Partial<Pick<Character,'equipment'|'resources'>>,includeInactive=false):CharacterResource[]{
 return (c.equipment??[]).flatMap(item=>{
  if(!item._id&&!item.grantId||trackerProblems(item.trackers).length)return []
  return (item.trackers??[]).flatMap(tracker=>{
   if(!includeInactive&&!trackerActive(item,tracker))return []
   const id=linkedItemResourceId(item,tracker),used=c.resources?.find(r=>r.id===id)?.used??item.trackerUses?.[tracker.id]??0
   return [{id,name:`${item.name} · ${tracker.name}`,max:tracker.max,used:Number.isInteger(used)&&used>=0&&used<=999?used:0,recovery:tracker.recovery,automatic:true,notes:tracker.notes,source:{kind:'item' as const,itemId:String(item._id??item.grantId),trackerId:tracker.id}}]
  })
 })
}
/** Keep uses with their inventory instance, including while inactive. Removed
 * definitions/copies take their counters with them; derived rows never persist. */
export function reconcileItemTrackers<T extends Pick<Character,'equipment'|'resources'>>(c:T):T{
 const saved=c.resources??[]
 const equipment=c.equipment.map(item=>{
  if(!item.trackers?.length&&!item.trackerUses)return item
  const trackerUses:Record<string,number>={}
  if(!trackerProblems(item.trackers).length)for(const t of item.trackers??[]){const used=saved.find(r=>r.id===linkedItemResourceId(item,t))?.used??item.trackerUses?.[t.id]??0;trackerUses[t.id]=Number.isInteger(used)&&used>=0&&used<=999?used:0}
  return {...item,trackerUses}
 })
 return {...c,equipment,...(c.resources?{resources:saved.filter(r=>!r.id.startsWith(LINKED_RESOURCE_PREFIX))}:{})}
}
