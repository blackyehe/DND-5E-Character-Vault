import { z } from 'zod'
import { workshopProblems, type WorkshopDraft } from '../../shared/homebrew-workshop'
import type { OrcbrewEntry } from './orcbrew'
const text=z.string().max(200),whole=(min:number,max:number)=>z.number().int().min(min).max(max)
const ability=z.enum(['str','dex','con','int','wis','cha'])
const schedule=z.array(z.object({level:whole(1,20),total:whole(0,99),originalLevel:whole(1,20).optional()})).max(20)
export const workshopDraftSchema=z.object({
  version:z.literal(1),id:z.string().uuid(),kind:z.enum(['class','subclass','race']),name:text.min(1),source:text.min(1),description:z.string().max(100000),
  race:z.object({speed:whole(0,1000),size:text.min(1),darkvision:whole(0,1000),languages:z.array(text).max(100),skills:z.array(text).max(18),abilityBonuses:z.object({str:whole(-10,10),dex:whole(-10,10),con:whole(-10,10),int:whole(-10,10),wis:whole(-10,10),cha:whole(-10,10)}),resistances:z.array(text).max(100),immunities:z.array(text).max(100),naturalArmor:z.string().max(10000),spells:z.array(z.object({id:z.string().uuid(),index:z.string().min(1).max(250),name:text.min(1),level:whole(1,20),ability,usage:z.string().max(10000),needsReview:z.boolean()})).max(100)}).optional(),
  parentClass:z.string().max(250),hitDie:whole(4,12),savingThrows:z.array(ability).max(6),armor:z.array(text).max(100),weapons:z.array(text).max(200),tools:z.array(text).max(100),
  skillCount:whole(0,18),skillOptions:z.array(text).max(18),expertiseCount:whole(0,18),subclassLevel:whole(1,20),subclassTitle:text,
  asiLevels:z.array(whole(1,20)).max(20),attacks:schedule,
  magic:z.object({enabled:z.boolean(),ability,progression:z.enum(['full','half','third','pact']),startsAt:whole(1,20),learning:z.enum(['known','prepared','book']),cantrips:schedule,spells:schedule,preparedLevel:z.enum(['full','half','none']),preparedBase:whole(0,99),spellList:z.array(z.string().max(250)).max(3000)}),
  resources:z.array(z.object({id:z.string().uuid(),name:text.min(1),level:whole(1,20),basis:z.enum(['fixed','level','ability','proficiency']),ability,multiplier:whole(0,99),base:whole(0,999),minimum:whole(0,999),recovery:z.enum(['short','long','manual']),unlimitedAt:whole(1,20).nullable(),notes:z.string().max(10000)})).max(100),
  features:z.array(z.object({id:z.string().uuid(),name:text.min(1),level:whole(1,20),description:z.string().max(100000),choice:z.boolean(),choose:whole(1,99),options:z.array(text).max(500),originalIndex:whole(0,2000).optional(),originalSelection:whole(0,2000).optional()})).max(1000),
  imported:z.object({index:z.string().max(250),contentKey:z.string().max(200).regex(/^[a-zA-Z0-9_./-]+$/),sources:z.array(text).max(100)}).optional(),
  published:z.object({revision:whole(1,1000000),index:z.string().max(250),packId:z.string().max(100),packHash:z.string().max(100)}).optional(),updatedAt:z.string().max(100),
}).superRefine((d,ctx)=>{
  for(const message of workshopProblems(d as WorkshopDraft))ctx.addIssue({code:'custom',message})
  for(const array of [d.features,d.resources])if(new Set(array.map(v=>v.id)).size!==array.length)ctx.addIssue({code:'custom',message:'Feature and resource identifiers must be unique.'})
  if(d.kind==='race'&&(!d.race||d.magic.enabled))ctx.addIssue({code:'custom',message:'Races require racial rules and use innate spells rather than class slot progression.'})
  if(d.race&&new Set(d.race.spells.map(s=>s.id)).size!==d.race.spells.length)ctx.addIssue({code:'custom',message:'Innate spell identifiers must be unique.'})
})
export function validatedDraft(value:unknown):WorkshopDraft|null {const result=workshopDraftSchema.safeParse(value);return result.success?result.data as WorkshopDraft:null}
/** Explicit revision lineage supersedes only that definition, keeping unrelated variants separate. */
export function activeWorkshopEntries(entries:OrcbrewEntry[],kind:'classes'|'subclasses'|'races'):OrcbrewEntry[] {
  const newest=new Map<string,{entry:OrcbrewEntry;draft:WorkshopDraft;revision:number}>()
  for(const entry of entries){const raw=entry.details as Record<string,unknown>,draft=validatedDraft(raw[':codex/workshop']);if(!draft)continue;const revision=Number(raw[':codex/revision'])||1;if(!newest.has(draft.id)||newest.get(draft.id)!.revision<revision)newest.set(draft.id,{entry,draft,revision})}
  const owners=new Map<string,Set<string>>()
  for(const {entry}of newest.values())for(const index of (entry.details as Record<string,unknown>)[':codex/previous-indexes'] as string[]??[]){const set=owners.get(index)??new Set();set.add(entry.index);owners.set(index,set)}
  const superseded=(index:string)=>owners.get(index)?.size===1?[...owners.get(index)!][0]:undefined
  return entries.filter(entry=>!superseded(entry.index)||superseded(entry.index)===entry.index).map(entry=>{
    const raw=entry.details as Record<string,unknown>,draft=validatedDraft(raw[':codex/workshop']);if(!draft)return entry
    const traits=draft.features.map(f=>({name:f.name,description:f.choice?`${f.description}\nChoose ${f.choose}: ${f.options.join('; ')}`:f.description,level:f.level}))
    const aliases=[...new Set([...entry.aliases as string[],...[...owners.keys()].filter(key=>superseded(key)===entry.index)])]
    return {...entry,...(kind==='classes'?{homebrew_traits:traits}:kind==='races'?{homebrew_traits:traits,speed:draft.race?.speed,size:draft.race?.size,languages:(draft.race?.languages??[]).map(name=>({index:name.toLowerCase().replace(/ /g,'-'),name,url:''})),ability_bonuses:Object.entries(draft.race?.abilityBonuses??{}).map(([index,bonus])=>({ability_score:{index,name:index.toUpperCase(),url:''},bonus}))}:{traits}),aliases,workshop:draft,workshopRevision:Number(raw[':codex/revision'])||1}
  })
}
