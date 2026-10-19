import type { AbilityKey } from './calc'
import type { BuilderDraft } from './character-builder'
import type { SrdClass, SrdRace, SrdSubrace, HomebrewTrait } from './srd'
export interface AdvancementChoice { kind: 'later' | 'asi' | 'feat'; feat: string; increases: Partial<Record<AbilityKey,number>> }
export interface AdvancementContext { klass?: SrdClass|null; race?: SrdRace|null; subrace?: SrdSubrace|null }
export function featOpportunities(draft:BuilderDraft, context:AdvancementContext) {
  const key=(context.klass?.contentKey??context.klass?.index??draft.klass).replace(/^.*\//,'').toLowerCase()
  const traits=(context.klass as (SrdClass&{homebrew_traits?:HomebrewTrait[]})|null)?.homebrew_traits
  const known=['barbarian','bard','cleric','druid','fighter','monk','paladin','ranger','rogue','sorcerer','warlock','wizard','artificer'].includes(key)
  const explicit=traits?.filter(t=>/ability score improvement/i.test(t.name)&&t.level).map(t=>t.level!)??[]
  const levels=context.klass?.workshop?.asiLevels??(explicit.length ? [...new Set(explicit)] : known ? key==='fighter'?[4,6,8,12,14,16,19]:key==='rogue'?[4,8,10,12,16,19]:[4,8,12,16,19] : [])
  const racialTraits=[...((context.race as (SrdRace&{homebrew_traits?:HomebrewTrait[]})|null)?.homebrew_traits??[]),...((context.subrace as (SrdSubrace&{homebrew_traits?:HomebrewTrait[]})|null)?.homebrew_traits??[])]
  const variant=/variant.*human|human.*variant/i.test(`${context.race?.name??''} ${context.subrace?.name??''}`)
  const granted=variant||racialTraits.some(t=>/^feat(s)?$/i.test(t.name)&&/one feat|a feat|1 feat/i.test(t.description))?1:0
  const racial=draft.racialFeatCountOverride??granted
  return { known:!!context.klass?.workshop||known||!!traits?.some(t=>/ability score improvement/i.test(t.name)), racial,
    slots:[...levels.filter(l=>l<=draft.level).map(level=>({key:`class-${level}`,level,label:`Class level ${level}`,racial:false})),...Array.from({length:Math.max(0,Math.min(10,racial))},(_,i)=>({key:`racial-${i}`,level:1,label:`Racial bonus feat ${i+1}`,racial:true})),
      ...(draft.featLimitOverride?Object.keys(draft.advancements??{}).filter(k=>k.startsWith('extra-')).map(key=>({key,level:1,label:'Extra feat · override',racial:true})):[])] }
}
export function selectedFeatIndexes(draft:BuilderDraft,context:AdvancementContext) {
  return [...new Set([...featOpportunities(draft,context).slots.flatMap(s=>{const c=draft.advancements?.[s.key];return c?.kind==='feat'&&c.feat?[c.feat]:[]}),...(draft.featLimitOverride?draft.feats:[])])]
}
