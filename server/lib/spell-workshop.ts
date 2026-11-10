import {z} from 'zod'
import {normalizeBuilderEntry} from './entry-builder-schema'
import {benefitProblems} from '../../shared/rule-benefits'
import type {SpellDraft} from '../../shared/spell-workshop'
import type {OrcbrewEntry} from './orcbrew'
const published=z.object({revision:z.number().int().min(1),index:z.string().min(1).max(300),packId:z.string().regex(/^[a-f0-9]{24}$/i),packHash:z.string().length(64)}).strict()
export const spellDraftSchema=z.object({version:z.literal(1),id:z.uuid(),kind:z.literal('spells'),source:z.string().trim().min(1).max(200),body:z.record(z.string(),z.unknown()),benefits:z.array(z.unknown()).max(200),updatedAt:z.string().max(60),published:published.optional()}).strict()
export function validatedSpell(value:unknown):SpellDraft{
 const d=spellDraftSchema.parse(value),entry=normalizeBuilderEntry({name:d.body.name,spellBuilder:d.body,benefits:d.benefits},'spells'),issues=benefitProblems(d.benefits)
 if(issues.length)throw Error(issues[0])
 return {...d,body:entry.spellBuilder} as SpellDraft
}
export function readNativeSpell(details:unknown):SpellDraft|undefined{try{return validatedSpell((details as Record<string,unknown>)?.[':codex/spell'])}catch{return undefined}}
export function nativeSpell(entry:OrcbrewEntry){return Number.isSafeInteger(entry.spellRevision)&&Number(entry.spellRevision)>0?readNativeSpell(entry.details):undefined}
export const spellKey=(id:string)=>`codex-spell-${id}`
export function spellRecord(draft:SpellDraft,revision:number,previous:string[],origin?:OrcbrewEntry){
 const {published:_,...native}=draft,s=draft.body
 return {...origin?.details as Record<string,unknown>,':name':s.name,':description':s.description,':option-pack':draft.source,':level':s.level,':school':':'+s.school,':casting-time':s.castingTime,':range':s.range,':duration':s.duration,':ritual?':s.ritual,
  ':components':{':verbal':s.components.includes('V'),':somatic':s.components.includes('S'),':material':s.components.includes('M')?(s.material||true):false},':spell-lists':Object.fromEntries(s.classes.map(k=>[':'+k,true])),
  ':codex/spell':native,':codex/revision':revision,':codex/previous-indexes':[...new Set(previous)].slice(-200)}
}
