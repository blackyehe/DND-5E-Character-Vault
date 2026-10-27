import {z} from 'zod'
import {completeMonster} from './monster-workshop-schema'
import {applyEntryBuilder,type SpellBuilder,type OptionBuilder} from '../../shared/entry-builders'
import type {CompendiumKind,EntryData} from '../../shared/compendium-editing'
const text=z.string().max(100000),short=z.string().max(2000),name=z.string().trim().min(1).max(200)
const progression=z.record(z.string().regex(/^(?:[0-9]|1[0-9]|20)$/),z.string().min(1).max(100))
const spellSchema=z.object({name,description:text,higherLevel:text,level:z.number().int().min(0).max(9),school:z.string().min(1).max(100),castingTime:short,range:short,duration:short,concentration:z.boolean(),ritual:z.boolean(),components:z.array(z.enum(['V','S','M'])).max(3),material:short,attackType:z.enum(['','melee','ranged']),saveAbility:z.enum(['','str','dex','con','int','wis','cha']),saveSuccess:short,damageType:z.string().max(100),damage:progression,healing:progression,areaType:z.string().max(100),areaSize:z.number().int().min(0).max(100000),classes:z.array(z.string().max(300)).max(300)}).strict()
const optionSchema=z.object({name,description:text,prerequisites:text,featureName:short,featureDescription:text,options:z.array(short).max(500),choose:z.number().int().min(1).max(200),script:short,languageType:short,typicalSpeakers:z.array(short).max(200),equipment:text}).strict()
export function normalizeBuilderEntry(entry:EntryData,kind:CompendiumKind):EntryData{
 const e={...entry}
 if(e.monsterDraft){if(kind!=='monsters')throw new Error('Keep the creature builder in its original category.');e.monsterDraft=completeMonster(e.monsterDraft)}
 if(e.spellBuilder){if(kind!=='spells')throw new Error('Keep the spell builder in its original category.');e.spellBuilder=spellSchema.parse(e.spellBuilder) as SpellBuilder}
 if(e.optionBuilder){if(['classes','subclasses','races','subraces','monsters','equipment','magic-items','spells'].includes(kind))throw new Error('Use this category’s dedicated builder.');e.optionBuilder=optionSchema.parse(e.optionBuilder) as OptionBuilder}
 return applyEntryBuilder(e,kind)
}
