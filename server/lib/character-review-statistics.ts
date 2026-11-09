import type {Character} from '../../shared/character'
import type {ReviewStat} from '../../shared/definition-review'
import {characterBenefits,benefitSpellAttack,benefitSpellDC} from '../../shared/rule-benefits'
import {sheetAC,sheetInitiative,sheetSave,sheetSkillRows,signed,attackValues} from '../../src/lib/character-sheet'
import {slotsFor} from '../../shared/character-progression'

/** Compare the same effective totals the sheet displays, without altering play state. */
export function characterReviewStatistics(before:Character,after:Character):ReviewStat[]{
 const a=characterBenefits(before),b=characterBenefits(after),rows:ReviewStat[]=[]
 const add=(label:string,x:number|string,y:number|string,always=false)=>{if(always||x!==y)rows.push({label,before:String(x),after:String(y)})}
 const magic=[before,after].some(c=>c.spellcasting.known.length||c.spellcasting.prepared.length||Object.values(slotsFor(c)).some(s=>s.max>0))||a.spellAttack!==b.spellAttack||a.spellDC!==b.spellDC
 if(magic){add('Spell attack',signed(benefitSpellAttack(before,a)),signed(benefitSpellAttack(after,b)),true);add('Spell save DC',benefitSpellDC(before,a),benefitSpellDC(after,b),true)}
 add('Armor class',sheetAC(before,a),sheetAC(after,b));add('Initiative',signed(sheetInitiative(before,a)),signed(sheetInitiative(after,b)));add('Walking speed',a.speed,b.speed)
 for(const key of ['str','dex','con','int','wis','cha'] as const)add(`${key.toUpperCase()} saving throw`,signed(sheetSave(before,key,a)),signed(sheetSave(after,key,b)))
 const skills=sheetSkillRows(after,b);for(const old of sheetSkillRows(before,a)){const next=skills.find(s=>s.key===old.key)!;add(old.name,signed(old.modifier),signed(next.modifier))}
 // Stored attacks retain their order and identity through definition reviews.
 before.attacks.forEach((attack,i)=>{const next=after.attacks[i];if(!next)return;const x=attackValues(before,attack,undefined,a),y=attackValues(after,next,undefined,b);add(`${attack.name} attack ${i+1}`,signed(x.toHit),signed(y.toHit));add(`${attack.name} damage ${i+1}`,x.text,y.text)})
 return rows
}
