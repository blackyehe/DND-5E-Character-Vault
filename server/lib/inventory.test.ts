import { describe,it,expect } from 'vitest'
import { emptyCharacter,type Character,type EquipmentItem } from '../../shared/character'
import { equipmentFrom,magicEquipmentFrom,type EquipmentDefinition,type MagicItemDefinition } from '../../shared/equipment-definitions'
import { itemBonuses,withItemBaseline } from '../../shared/item-rules'
import { sheetAC } from '../../src/lib/character-sheet'
import { applyItemTemplate,grantSchema,inventoryAfterGrant } from './inventory'
import { playUpdateSchema,applyPlayUpdate } from './play-update'
import { resolveEquipmentItem } from './equipment-references'
import equipment from '../data/srd-2014-equipment.json'
import magic from '../data/srd-2014-magic-items.json'

const character=():Character=>({...emptyCharacter(),_id:'a'.repeat(24),updatedAt:'2026-10-19T00:00:00.000Z'})
const ring=()=>magicEquipmentFrom(magic.find(i=>i.index==='ring-of-protection') as MagicItemDefinition)
const delivery='f3c23168-460b-45bc-85f4-d71bc729d4bf'
describe('item creation, delivery and play',()=>{
  it('builds a normal weapon with its statistics and a magic ring with its actual rules',()=>{
    const sword=equipmentFrom(equipment.find(i=>i.index==='longsword') as EquipmentDefinition)
    expect(sword.weapon?.dice).toBe('1d8')
    expect(ring()).toMatchObject({magicIndex:'ring-of-protection',requiresAttunement:true,effects:{ac:1,saves:1}})
  })
  it('validates both normal and magic custom definitions and rejects incomplete weapons',()=>{
    const normal={name:'Iron token',qty:1,weight:0.1,equipped:false,notes:'',kind:'gear',magical:false}
    expect(grantSchema.safeParse({requestId:delivery,item:normal}).success).toBe(true)
    expect(grantSchema.safeParse({requestId:delivery,item:{...normal,magical:true,kind:'accessory',effects:{ac:2,saves:1},requiresAttunement:true}}).success).toBe(true)
    expect(grantSchema.safeParse({requestId:delivery,item:{...normal,kind:'weapon'}}).success).toBe(false)
  })
  it('accepts absent reference fields represented as null by an older template document',()=>{
    const parsed=grantSchema.parse({requestId:delivery,item:{...ring(),kind:'accessory',index:null,referenceDescription:null,armor:null,weapon:null,templateRevision:null}})
    expect(parsed.item.index).toBeUndefined();expect(parsed.item.armor).toBeUndefined();expect(parsed.item.name).toBe('Ring of Protection')
  })
  it('delivers once without replacing HP, spell uses, resources, or existing gear',()=>{
    const c=character();c.combat.hpCurrent=7;c.spellcasting.slots.l1={max:4,used:2};c.resources=[{id:'ki',name:'Ki',max:4,used:2,recovery:'short'}]
    const result=inventoryAfterGrant(c,{...ring(),equipped:true,attuned:true},delivery)
    const again=inventoryAfterGrant({...c,equipment:result.equipment},ring(),delivery)
    expect(again.duplicate).toBe(true);expect(again.equipment).toHaveLength(1)
    expect(c.combat.hpCurrent).toBe(7);expect(c.spellcasting.slots.l1!.used).toBe(2);expect(c.resources[0]!.used).toBe(2)
    expect(result.equipment[0]).toMatchObject({kind:'accessory',grantId:delivery})
  })
  it('applies +1 AC and saves only when equipped and attuned, and never multiplies by quantity',()=>{
    const c=character();c.combat.ac=17;c.combat.itemAcBaseline=0
    c.equipment=[{...ring(),qty:5,equipped:true,attuned:false}]
    expect(sheetAC(c)).toBe(17);expect(itemBonuses(c).saves).toBe(0)
    c.equipment[0]!.attuned=true
    expect(sheetAC(c)).toBe(18);expect(itemBonuses(c).saves).toBe(1)
    c.equipment[0]!.equipped=false
    expect(sheetAC(c)).toBe(17);expect(itemBonuses(c).saves).toBe(0)
  })
  it('adds different protection items, but not duplicate copies',()=>{
    const c=character();const active={...ring(),equipped:true,attuned:true}
    c.equipment=[active,{...active},{...active,magicIndex:'cloak-of-protection',name:'Cloak of Protection'}]
    expect(itemBonuses(c)).toEqual({ac:2,saves:2})
  })
  it('preserves imported AC without doubling an already worn protection item',()=>{
    const c=character();c.combat.ac=17;c.equipment=[resolveEquipmentItem({...ring(),requiresAttunement:undefined,attuned:undefined,equipped:true})]
    const initial=withItemBaseline(c)
    expect(initial.combat.itemAcBaseline).toBe(1);expect(sheetAC(initial)).toBe(17)
    initial.equipment=[...initial.equipment,{...ring(),name:'Different protection',magicIndex:undefined,templateId:'b'.repeat(24),equipped:true,attuned:true}]
    expect(sheetAC(initial)).toBe(18)
  })
  it('keeps mundane armour AC while its attunement-dependent enchantment is inactive',()=>{
    const c=character();c.combat.acMode='equipment';c.abilities.dex=14
    c.equipment=[{name:'Arcane leather',kind:'armour',qty:1,weight:10,notes:'',equipped:true,requiresAttunement:true,attuned:false,armor:{base:11,dex:true,shield:false},magicBonus:2}]
    expect(sheetAC(c)).toBe(13);c.equipment[0]!.attuned=true;expect(sheetAC(c)).toBe(15)
  })
  it('lets players attune, but rejects forged permanent bonuses and a fourth attunement',()=>{
    const c=character();const active=()=>({...ring(),equipped:true,attuned:true})
    c.equipment=[{...active(),_id:'one'},...['two','three'].map(id=>({...active(),_id:id,magicIndex:id}))]
    c.equipment.push({...ring(),_id:'four',magicIndex:'four'})
    const action={expectedUpdatedAt:c.updatedAt,equipment:[{id:'four',qty:1,equipped:true,attuned:true}]}
    expect(()=>applyPlayUpdate(c,playUpdateSchema.parse(action))).toThrow(/three/)
    expect(playUpdateSchema.safeParse({...action,equipment:[{...action.equipment[0],effects:{ac:99,saves:99}}]}).success).toBe(false)
    const allowed=applyPlayUpdate(characterWithRing(),{expectedUpdatedAt:c.updatedAt,equipment:[{id:'ring',qty:1,equipped:true,attuned:true}]})
    expect((allowed.equipment as EquipmentItem[])[0]!.attuned).toBe(true)
  })
  it('updates every linked copy while retaining its quantity, equipment, attunement, notes and identity',()=>{
    const copy={...ring(),_id:'ring',templateId:'b'.repeat(24),templateRevision:0,grantId:delivery,qty:2,equipped:true,attuned:true,notes:'Found in the ruined tower.'}
    const changed={...ring(),name:'Revised protection ring',effects:{ac:2,saves:2}}
    const result=applyItemTemplate([copy,{...ring(),_id:'unlinked'}],changed,copy.templateId,1)
    expect(result[0]).toMatchObject({_id:'ring',name:'Revised protection ring',qty:2,equipped:true,attuned:true,grantId:delivery,templateRevision:1,effects:{ac:2,saves:2},notes:copy.notes})
    expect(result[1]!.name).toBe('Ring of Protection')
  })
  it('never replaces a newer template copy with an older revision',()=>{
    const copy={...ring(),templateId:'b'.repeat(24),templateRevision:2,effects:{ac:3,saves:3}}
    expect(applyItemTemplate([copy],ring(),copy.templateId,1)[0]).toBe(copy)
  })
})
function characterWithRing(){const c=character();c.combat.itemAcBaseline=0;c.equipment=[{...ring(),_id:'ring'}];return c}
