import type {AdvancementRules} from '../../shared/level-up'
import {ruleName} from '../../shared/workshop-character'
import {contentLabel,type SrdRef} from './srd'

export interface AdvancementSpell extends SrdRef {level:number;classes?:{index:string;name?:string}[]}
export type SpellOrder='level'|'name'|'source'
export const spellHasReference=(spell:AdvancementSpell,id:string)=>spell.index===id||spell.aliases?.includes(id)===true
export const spellIsKnown=(spell:AdvancementSpell,known:readonly string[])=>known.some(id=>spellHasReference(spell,id))
export function mergeAdvancementSpells(...lists:readonly AdvancementSpell[][]):AdvancementSpell[]{return [...new Map(lists.flat().map(s=>[s.index,s])).values()]}
/** Authored Workshop lists are authoritative. SRD membership is supplemented by
 * explicit imported class declarations, never inferred from a matching name. */
export function eligibleClassSpells(spells:AdvancementSpell[],rules:AdvancementRules,standardList:readonly string[]):AdvancementSpell[]{
 const authored=rules.workshop?.magic.spellList??[],extra=rules.spellListExtras??[]
 const listed=(spell:AdvancementSpell,ids:readonly string[])=>ids.some(id=>spellHasReference(spell,id)||spell.contentKey===id)
 return spells.filter(s=>Number.isInteger(s.level)&&s.level>=0&&s.level<=9&&(
  listed(s,extra)||(authored.length?listed(s,authored):rules.source!=='2014 SRD'||standardList.includes(s.index)||s.classes?.some(c=>c.index===rules.index||ruleName(c.index)===ruleName(rules.name)))
 ))
}
export function queryAdvancementSpells(spells:readonly AdvancementSpell[],query:string,level:string,order:SpellOrder){
 const terms=query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
 return spells.filter(s=>(!level||s.level===Number(level))&&terms.every(term=>`${contentLabel(s)} ${s.name} ${s.sourcePack??'SRD 2014'}`.toLocaleLowerCase().includes(term))).sort((a,b)=>(order==='level'?a.level-b.level:order==='source'?(a.sourcePack??'SRD 2014').localeCompare(b.sourcePack??'SRD 2014'):0)||contentLabel(a).localeCompare(contentLabel(b))||a.index.localeCompare(b.index))
}
