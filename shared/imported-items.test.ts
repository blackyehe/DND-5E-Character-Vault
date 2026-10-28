import {describe,it,expect} from 'vitest'
import {importedEquipment} from './imported-items'
import {inspectOrcbrew} from '../server/lib/orcbrew'
import {writeEdn} from '../server/lib/workshop-pack'
import {itemSchema} from '../server/lib/inventory'
import {resolveEquipmentItem} from '../server/lib/equipment-references'

describe('imported equipment delivery',()=>{
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
