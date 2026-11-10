import {expect,it} from 'vitest'
import {emptyCharacter} from '../../shared/character'
import {benefitSpellAttack,benefitSpellDC} from '../../shared/rule-benefits'
import {entrySpellDraft} from '../../shared/spell-builder'
import {spellProfile} from './spell-profile'
import type {SrdSpell} from './srd'

const attack={attack_type:'ranged'} as SrdSpell,save={dc:{dc_type:{index:'dex'}}} as SrdSpell
function character(){const c={...emptyCharacter(),_id:'hero',updatedAt:'2026-11-10T12:00:00.000Z'};c.meta.level=6;c.abilities.cha=18;c.abilities.int=12;c.spellcasting.ability='cha';c.features=[{name:'Contractor',description:'',origin:'feat'}];c.compendiumRules=[{kind:'feats',index:'contractor',revision:1,before:{name:'Contractor'},entry:{name:'Contractor',benefits:[{type:'spell-attack-bonus',value:1},{type:'spell-dc-bonus',value:1}]}}];c.equipment=[{name:'Prison',qty:1,weight:1,notes:'',equipped:true,requiresAttunement:true,attuned:true,benefits:[{type:'spell-attack-bonus',value:3},{type:'spell-dc-bonus',value:3}]}];return c}
it('matches current sheet totals and respects equipment, attunement and feat changes',()=>{
 const c=character();expect(spellProfile(c,attack).attack).toBe(11);expect(spellProfile(c,save).save).toEqual({ability:'DEX',dc:19});expect(spellProfile(c,attack).attack).toBe(benefitSpellAttack(c));expect(spellProfile(c,save).save!.dc).toBe(benefitSpellDC(c))
 c.equipment[0]!.attuned=false;expect(spellProfile(c,attack).attack).toBe(8);c.compendiumRules![0]!.entry.benefits=[];expect(spellProfile(c,save).save!.dc).toBe(15)
})
it('uses a grant ability without inheriting the sheet ability or a published class list',()=>{
 const c=character();expect(spellProfile(c,{...attack,classes:[{index:'wizard',name:'Wizard',url:''}]},'Arcane lineage','int')).toMatchObject({source:'Arcane lineage',ability:'INT',attack:8});expect(spellProfile(c,save,'Granted feat','int').save).toEqual({ability:'DEX',dc:16});expect(c.spellcasting.ability).toBe('cha');expect(spellProfile(c,attack).source).toBe('Spellbook')
})
it('shows only applicable mechanics, preserving spells with both attacks and saves',()=>{
 const c=character();expect(spellProfile(c,attack).save).toBeUndefined();expect(spellProfile(c,save).attack).toBeUndefined();expect(spellProfile(c,{...attack,...save})).toMatchObject({attack:11,save:{ability:'DEX',dc:19}})
 expect(spellProfile(c,{spellBuilder:entrySpellDraft({name:'Utility'})} as SrdSpell).note).toBe('No attack or save')
})
it('does not invent rolls for missing, unconfirmed or unstructured imported definitions',()=>{
 const c=character();for(const spell of [undefined,{...attack,definitionAvailable:false}])expect(spellProfile(c,spell).attack).toBeUndefined()
 expect(spellProfile(c,attack,'Racial','int',undefined,true).note).toBe('Confirm casting rules');expect(spellProfile(c,attack,'Racial','int',undefined,true).attack).toBeUndefined()
 const imported={homebrew:true,desc:['Make a ranged spell attack.'],classes:[]} as unknown as SrdSpell;expect(spellProfile(c,imported)).toMatchObject({note:'See rules'});expect(spellProfile(c,imported).attack).toBeUndefined()
 expect(spellProfile(c,{dc:{dc_type:{index:'unknown'}}} as SrdSpell).save).toBeUndefined()
})
