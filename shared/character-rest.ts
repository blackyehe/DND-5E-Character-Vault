import type {Character} from './character'
import {slotsFor} from './character-progression'
import {resourcesFor} from './character-resources'

/** Shared rest controls recover tracked uses. HP and hit dice remain manual. */
export function restUpdate(c:Character,kind:'short'|'long'):Pick<Character,'resources'|'spellcasting'>{
 const recovery=(value?:string)=>value??(c.meta.klass.toLowerCase()==='warlock'?'short':'long')
 return {
  resources:resourcesFor(c).map(r=>({...r,used:!r.unlimited&&(r.recovery===kind||kind==='long'&&r.recovery==='short')?0:r.used})),
  spellcasting:{...c.spellcasting,slots:Object.fromEntries(Object.entries(slotsFor(c)).map(([key,s])=>[key,{...s,used:kind==='long'||recovery(s.recovery)==='short'?0:s.used}]))},
 }
}
