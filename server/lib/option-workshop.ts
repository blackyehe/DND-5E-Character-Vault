import {z} from 'zod'
import {normalizeBuilderEntry} from './entry-builder-schema'
import {benefitProblems} from '../../shared/rule-benefits'
import type {OptionDraft} from '../../shared/option-workshop'
import type {OrcbrewEntry} from './orcbrew'
import {OPTION_KINDS} from '../../shared/option-kinds'
const published=z.object({revision:z.number().int().min(1),index:z.string().min(1).max(300),packId:z.string().regex(/^[a-f0-9]{24}$/i),packHash:z.string().length(64),definitionRevision:z.number().int().min(0).optional()}).strict()
export const optionDraftSchema=z.object({version:z.literal(1),id:z.uuid(),kind:z.enum(OPTION_KINDS),source:z.string().trim().min(1).max(200),body:z.record(z.string(),z.unknown()),benefits:z.array(z.unknown()).max(200),updatedAt:z.string().max(60),published:published.optional()}).strict()
export function validatedOption(value:unknown):OptionDraft{
 const parsed=optionDraftSchema.parse(value),entry=normalizeBuilderEntry({name:parsed.body.name,optionBuilder:parsed.body,benefits:parsed.benefits},parsed.kind)
 if(parsed.kind==='selections'&&!(entry.optionBuilder as OptionDraft['body']).choiceGroup)throw new Error('Define structured choices before saving a new choice group.')
 const issues=benefitProblems(parsed.benefits);if(issues.length)throw new Error(issues[0])
 return {...parsed,body:entry.optionBuilder} as OptionDraft
}
export function nativeOption(entry:OrcbrewEntry):OptionDraft|undefined{try{if(!Number.isSafeInteger(entry.optionRevision)||Number(entry.optionRevision)<1)return;return validatedOption((entry.details as Record<string,unknown>)[':codex/option'])}catch{return undefined}}
export function optionRecord(draft:OptionDraft,revision:number,previous:string[],origin?:OrcbrewEntry){
 const {published:_,...native}=draft,body=draft.body
 const old=origin?.details as Record<string,unknown>|undefined
 const preserved={...old};if(draft.kind==='subraces')delete preserved[':speed']
 return {...preserved,':name':body.name,':description':body.description,':help':body.description,':option-pack':draft.source,
  ':prereqs':body.prerequisites,':traits':draft.kind==='backgrounds'&&body.featureName?[{':name':body.featureName,':description':body.featureDescription}]:[],
  ':codex/option':native,':codex/revision':revision,':codex/previous-indexes':[...new Set(previous)].slice(-200),
  ':codex/equipment-notes':body.equipment,
  ...(draft.kind==='subraces'&&body.subrace?{':race':body.subrace.parentIndex,':abilities':Object.fromEntries(Object.entries(body.subrace.bonuses).map(([k,v])=>[':'+k,v])),...(body.subrace.speed===null?{}:{':speed':body.subrace.speed}),':traits':[{':name':body.name,':description':body.description}]}:{}),
 }
}
export const optionKey=(id:string)=>`codex-option-${id}`
