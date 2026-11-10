import type {Character} from './character'
import {slotsFor} from './character-progression'
import {resourcesFor} from './character-resources'
import {itemTrackerResources} from './linked-trackers'

/** Shared rest controls recover tracked uses. HP and hit dice remain manual. */
export function restUpdate(c:Character,kind:'short'|'long'):Pick<Character,'resources'|'spellcasting'>{
 const recovery=(value?:string)=>value??(c.meta.klass.toLowerCase()==='warlock'?'short':'long')
 const resources=resourcesFor(c),eligible=(value:string)=>value===kind||kind==='long'&&value==='short'
 // A carried item's charges recover even when its equipment-gated tracker is hidden.
 const inactive=itemTrackerResources({...c,equipment:c.equipment.filter(i=>i.qty>0)},true).filter(r=>!resources.some(visible=>visible.id===r.id)&&eligible(r.recovery))
 return {
  resources:[...resources,...inactive].map(r=>({...r,used:!r.unlimited&&eligible(r.recovery)?0:r.used})),
  spellcasting:{...c.spellcasting,slots:Object.fromEntries(Object.entries(slotsFor(c)).map(([key,s])=>[key,{...s,used:kind==='long'||recovery(s.recovery)==='short'?0:s.used}]))},
 }
}
