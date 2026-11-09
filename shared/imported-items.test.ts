import {describe,it,expect} from 'vitest'
import {importedEquipment} from './imported-items'
import {inspectOrcbrew} from '../server/lib/orcbrew'
import {writeEdn} from '../server/lib/workshop-pack'
import {itemSchema} from '../server/lib/inventory'
import {resolveEquipmentItem} from '../server/lib/equipment-references'

describe('imported equipment delivery',()=>{
 it('preserves authored spell benefits independently of the item description and source object',()=>{
  const benefits=[{type:'spell-attack-bonus',value:3,level:1},{type:'spell-dc-bonus',value:3,level:1}]
  const item=importedEquipment({index:'homebrew-focus',name:'Test focus',benefits,workshopItem:{name:'Test focus',qty:1,weight:1,equipped:false,notes:'',kind:'accessory',requiresAttunement:true}},'magic-items')
  expect(item.benefits).toEqual(benefits)
  expect(item.benefits).not.toBe(benefits)
  expect(itemSchema.parse(item).benefits).toEqual(benefits)
  expect(resolveEquipmentItem(item).benefits).toEqual(benefits)
 })
 it('converts fixed imported spell attack and save DC bonuses into inventory benefits',()=>{
  const entry=inspectOrcbrew(writeEdn({':orcpub.dnd.e5/magic-items':{':focus':{':name':'Test focus',':codex/item':{item:{name:'Test focus',type:'RD',bonusSpellAttack:'+3',bonusSpellSaveDc:'+3',reqAttune:true},description:'Full focus rules.',mundane:false,hash:'test_focus',sourceName:'Trial pack',typeText:'rod'}}}})).entries['magic-items'][0]!
  const item=importedEquipment(entry,'magic-items')
  expect(item.benefits).toEqual([{type:'spell-attack-bonus',value:3,level:1},{type:'spell-dc-bonus',value:3,level:1}])
  expect(itemSchema.safeParse(item).success).toBe(true)
 })
 it('honors explicit replacement and removal instead of restoring imported spell bonuses',()=>{
  const entry={index:'homebrew-focus',name:'Test focus',details:{':codex/item':{item:{bonusSpellAttack:'+3',bonusSpellSaveDc:'+3'}}}}
  expect(importedEquipment({...entry,benefits:[]},'magic-items').benefits).toEqual([])
  expect(importedEquipment({...entry,benefits:[{type:'spell-attack-bonus',value:1,level:5}]},'magic-items').benefits).toEqual([{type:'spell-attack-bonus',value:1,level:5}])
  expect(importedEquipment({...entry,details:{':codex/item':{item:{bonusSpellAttack:'PB',bonusSpellSaveDc:'+99'}}}},'magic-items').benefits).toBeUndefined()
 })
 it('converts a real normalized imported weapon with its full rules and numeric bonus',()=>{
  const entry=inspectOrcbrew(writeEdn({':orcpub.dnd.e5/magic-items':{':blade':{':name':'Room Blade +2',':codex/item':{item:{name:'Room Blade +2',type:'M',weapon:true,dmg1:'1d8',dmgType:'S',weaponCategory:'martial',_baseName:'Longsword',bonusWeapon:'+2',weight:3,rarity:'rare',reqAttune:true},description:'Unabridged imported rules. Extra 2d6 fire damage on a command.',mundane:false,hash:'room_blade',sourceName:'Trial pack',typeText:'martial weapon'}}}})).entries['magic-items'][0]!
  const item=importedEquipment(entry,'magic-items')
  expect(item).toMatchObject({name:'Room Blade +2',index:'longsword',magicIndex:entry.index,description:'Unabridged imported rules. Extra 2d6 fire damage on a command.',magicBonus:2,requiresAttunement:true,attuned:false,equipped:false,weapon:{dice:'1d8',damageType:'slashing',category:'martial'}})
  expect(itemSchema.safeParse(item).success).toBe(true)
  expect(item.weapon?.dice).toBe('1d8') // conditional extra damage remains text
  expect(resolveEquipmentItem(item)).toMatchObject({magicIndex:entry.index,index:'longsword',magicBonus:2,description:item.description})
 })
 it('recovers the description omitted from filterItem and strips saved-instance identity',()=>{
  const source={name:'Old name',qty:9,weight:1,equipped:true,attuned:true,notes:'',kind:'accessory',magical:true,_id:'saved',grantId:'delivery',templateId:'foreign',templateRevision:4}
  const item=importedEquipment({index:'homebrew-jewel',name:'Imported Jewel',workshopItem:source,itemView:{description:'Full item description'},details:{':codex/item':{item:{bonusAc:'+1',bonusSavingThrow:'+1'}}}},'magic-items')
  expect(item).toMatchObject({name:'Imported Jewel',qty:1,equipped:false,attuned:false,description:'Full item description',effects:{ac:1,saves:1}})
  for(const key of ['_id','grantId','templateId','templateRevision'])expect(item).not.toHaveProperty(key)
  expect(source.qty).toBe(9);expect(source.equipped).toBe(true);expect(itemSchema.safeParse(item).success).toBe(true)
 })
 it('supports simple Orcbrew items without fabricating formula bonuses',()=>{
  const item=importedEquipment({index:'homebrew-jewel',name:'Trial Jewel',desc:['A plain imported description.'],details:{':codex/item':{item:{bonusAc:'PB',bonusSavingThrow:'+99'}}}},'magic-items')
  expect(item).toMatchObject({magical:true,description:'A plain imported description.',effects:{ac:0,saves:0}})
  expect(itemSchema.safeParse(item).success).toBe(true)
 })
 it('does not count an armour enchantment twice',()=>{
  const item=importedEquipment({index:'homebrew-plate',name:'Plate +2',workshopItem:{name:'Plate +2',qty:1,weight:65,equipped:false,notes:'',kind:'armour',armor:{base:18,dex:false,shield:false,category:'heavy'}},details:{':codex/item':{item:{bonusAc:'+2'}}}},'magic-items')
  expect(item.magicBonus).toBe(2);expect(item.effects?.ac).toBe(0);expect(itemSchema.safeParse(item).success).toBe(true)
 })
 it('allows mundane imported items whose reference rarity is none',()=>{
  const item=importedEquipment({index:'homebrew-rope',name:'Rope',workshopItem:{name:'Rope',qty:1,weight:10,equipped:false,notes:'',kind:'gear',rarity:'none'}},'equipment')
  expect(item.magical).toBe(false);expect(item.rarity).toBeUndefined();expect(itemSchema.safeParse(item).success).toBe(true)
 })
})
