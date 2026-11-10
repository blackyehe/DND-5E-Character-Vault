import type {Character} from '../../shared/character'
import {ABILITY_KEYS,abilityMod,profBonus,type AbilityKey} from '../../shared/calc'
import {characterBenefits,type CharacterBenefits} from '../../shared/rule-benefits'
import type {SrdSpell} from './srd'

export interface SpellProfile {source:string;ability:string;attack?:number;save?:{ability:string;dc:number};note?:string}
/** Published class lists are not character grants. Use the sheet ability or the
 * explicit grant ability, with the same active bonuses as the sheet totals. */
export function spellProfile(c:Character,spell:SrdSpell|undefined,source='Spellbook',ability:AbilityKey=c.spellcasting.ability,benefits:CharacterBenefits=characterBenefits(c),needsReview=false):SpellProfile{
 const result:SpellProfile={source,ability:ability.toUpperCase()}
 if(!spell||spell.definitionAvailable===false)return {...result,note:'Rules unavailable'}
 if(needsReview)return {...result,note:'Confirm casting rules'}
 const base=abilityMod(c.abilities[ability])+profBonus(c.meta.level)
 if(['melee','ranged'].includes(spell.attack_type??''))result.attack=base+benefits.spellAttack
 const save=spell.dc?.dc_type?.index?.toLowerCase()
 if(ABILITY_KEYS.includes(save as AbilityKey))result.save={ability:save!.toUpperCase(),dc:8+base+benefits.spellDC}
 if(result.attack===undefined&&!result.save)result.note=spell.homebrew&&!spell.spellBuilder?'See rules':'No attack or save'
 return result
}
