import {describe,it,expect} from 'vitest'
import {importedEquipment} from '../../shared/imported-items'
import {fiveToolsItemView} from '../../shared/five-tools-item'
import {MAX_ITEM_RULE_TEXT,WEAPON_DAMAGE_PATTERN} from '../../shared/item-validation'
import {itemSchema,grantSchema,inventoryAfterGrant} from './inventory'
import {emptyCharacter,type Character} from '../../shared/character'
import {equipmentAttacks} from '../../src/lib/equipment'
const hero=():Character=>({...emptyCharacter(),_id:'fixture',updatedAt:'v1'})
const imported=(name:string,raw:Record<string,unknown>,description='Complete special rules')=>importedEquipment({index:'homebrew-fixture',name,itemView:fiveToolsItemView({item:{name,...raw},description,mundane:true,hash:'test',sourceName:'Test',typeText:'Weapon'})},'equipment')
describe('fixed and special imported damage validation',()=>{
 it('preserves fixed damage through validation and delivery without turning it into dice',()=>{
  const item=imported('Blowgun',{type:'R',weaponCategory:'martial',dmg1:'1',dmgType:'P',range:'25/100'}),parsed=itemSchema.parse(item);expect(parsed.weapon?.dice).toBe('1');expect(parsed.weapon?.noDamage).not.toBe(true)
  const c=hero();c.abilities.dex=14;const given=inventoryAfterGrant(c,parsed,'fixed-delivery');expect(given.equipment[0]!.weapon?.dice).toBe('1');expect(equipmentAttacks(c,given.equipment[0]!)[0]!.text).toBe('1+2')
 })
 it.each([{type:'R',weaponCategory:'martial',property:['S','T'],range:'5/15'},{type:'M'}])('keeps absent base damage manual without inventing dice or type: %j',raw=>{
  const item=imported('Special weapon',raw),parsed=itemSchema.parse(item);expect(parsed.weapon).toMatchObject({dice:'',damageType:'',noDamage:true});expect(parsed.description).toBe('Complete special rules')
  const c=hero();c.abilities.str=20;parsed.magicBonus=3;const attack=equipmentAttacks(c,parsed)[0]!;expect(attack.damage).toBe(0);expect(attack.text).toBe('Special rules · see description')
 })
 it('still rejects incomplete ordinary weapons and invalid expressions, unless explicitly in manual special mode',()=>{
  const base=imported('Sword',{type:'M',dmg1:'1d8',dmgType:'S'});for(const dice of ['', '2+3','1d8;script','-1'])expect(itemSchema.safeParse({...base,weapon:{...base.weapon,dice}}).success).toBe(false)
  expect(itemSchema.safeParse({...base,weapon:{...base.weapon,damageType:''}}).success).toBe(false);expect(itemSchema.safeParse({...base,weapon:{...base.weapon,dice:'special',damageType:'',noDamage:true}}).success).toBe(true)
 })
 it('uses the same browser-compatible pattern for dice, spaced modifiers and fixed damage',()=>{
  const html=new RegExp('^(?:'+WEAPON_DAMAGE_PATTERN+')$','v'),base=imported('Weapon',{type:'M',dmg1:'1d8',dmgType:'S'});for(const dice of ['1','0','1d8','2D6 + 3','1d6-1']){expect(html.test(dice)).toBe(true);expect(itemSchema.safeParse({...base,weapon:{...base.weapon,dice}}).success).toBe(true)}expect(html.test('1d8 or 1d10')).toBe(false)
 })
 it('retains full oversized imported rules, bounds future inputs and leaves ordinary text untouched',()=>{
  const description='A'.repeat(31137),item=imported('Long rules',{type:'M',dmg1:'1d6',dmgType:'S'},description),parsed=grantSchema.parse({requestId:'7d4c53fb-9546-4b69-b201-2e8f2fa31a03',item});expect(parsed.item.description).toBe(description)
  expect(itemSchema.safeParse({...item,description:'A'.repeat(MAX_ITEM_RULE_TEXT+1)}).success).toBe(false);expect(itemSchema.safeParse({...item,referenceDescription:'A'.repeat(MAX_ITEM_RULE_TEXT+1)}).success).toBe(false)
 })
})
