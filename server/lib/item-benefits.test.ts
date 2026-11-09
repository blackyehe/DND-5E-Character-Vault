import {beforeEach,expect,it,vi} from 'vitest'
import {withItemBenefitEdition,templateBenefitEdition} from './item-benefits'
import {emptyCharacter,type EquipmentItem,type Character as CharacterData} from '../../shared/character'
import {grantSchema,inventoryAfterGrant} from './inventory'
import {Character} from '../models/Character'
import {benefitSpellAttack,benefitSpellDC} from '../../shared/rule-benefits'
import {savedCharacterOutput} from './character-output'
import {applyPlayUpdate,playUpdateSchema} from './play-update'

const mocks=vi.hoisted(()=>({findOne:vi.fn()}))
vi.mock('../models/CustomContent',()=>({CustomContent:{findOne:mocks.findOne}}))
const benefits=[{type:'spell-attack-bonus',value:3,level:1},{type:'spell-dc-bonus',value:3,level:1}]
const focus=():EquipmentItem=>({name:'Test focus',kind:'accessory',magical:true,qty:1,weight:1,notes:'',equipped:false,requiresAttunement:true,attuned:false})
beforeEach(()=>{mocks.findOne.mockReset()})

it('captures configured template benefits, supports explicit removal, and leaves the template untouched',()=>{
 const item={...focus(),benefits},copy=withItemBenefitEdition(item,{benefits:[]})
 expect(copy.benefits).toEqual([]);expect(item.benefits).toEqual(benefits)
 expect(withItemBenefitEdition(focus(),{benefits}).benefits).toEqual(benefits)
 expect(withItemBenefitEdition(focus(),{workshopItem:{...focus(),benefits}}).benefits).toEqual(benefits)
})

it('reads only the selected owner, item and category when granting a template',async()=>{
 mocks.findOne.mockReturnValue({select:()=>({lean:async()=>({data:{changes:{benefits}}})})})
 expect((await templateBenefitEdition('owner','a'.repeat(24),focus())).benefits).toEqual(benefits)
 expect(mocks.findOne).toHaveBeenCalledWith({userId:'owner',type:'compendium-edit','data.kind':'magic-items','data.index':`workshop-item-${'a'.repeat(24)}`})
})

it('retains spell bonuses through grant validation, database serialization, reload and player equip actions',async()=>{
 const c={...emptyCharacter(),_id:'a'.repeat(24),updatedAt:'2026-11-09T00:00:00.000Z'}
 c.meta.level=9;c.abilities.int=18
 const request=grantSchema.parse({requestId:'f3c23168-460b-45bc-85f4-d71bc729d4bf',item:withItemBenefitEdition(focus(),{benefits})})
 const equipment=inventoryAfterGrant(c,request.item,request.requestId).equipment
 const document=new Character({...c,userId:'b'.repeat(24),equipment})
 await document.validate()
 expect(document.toObject().equipment[0]!.benefits).toEqual(benefits)
 const reloaded=savedCharacterOutput(JSON.parse(JSON.stringify(document.toObject())))
 expect(reloaded.equipment[0]!.benefits).toEqual(benefits)
 const check=(character:CharacterData,attack:number,dc:number)=>{expect(benefitSpellAttack(character)).toBe(attack);expect(benefitSpellDC(character)).toBe(dc)}
 check(reloaded,8,16)
 const action=playUpdateSchema.parse({expectedUpdatedAt:reloaded.updatedAt,equipment:[{id:String(reloaded.equipment[0]!._id),qty:1,equipped:true,attuned:true}]})
 const equipped={...reloaded,...applyPlayUpdate(reloaded,action)} as CharacterData
 check(equipped,11,19)
 expect(playUpdateSchema.safeParse({...action,equipment:[{...action.equipment![0],benefits}]}).success).toBe(false)
 const removed={...equipped,...applyPlayUpdate(equipped,{...action,equipment:[{...action.equipment![0]!,equipped:false}]})} as CharacterData
 check(removed,8,16)
})

it('rejects invalid captured benefit values at both grant and database validation',async()=>{
 expect(grantSchema.safeParse({requestId:'f3c23168-460b-45bc-85f4-d71bc729d4bf',item:{...focus(),benefits:[{type:'spell-dc-bonus',value:999}]}}).success).toBe(false)
 const document=new Character({userId:'b'.repeat(24),equipment:[{...focus(),benefits:[{type:'spell-dc-bonus',value:999}]}]})
 await expect(document.validate()).rejects.toThrow('Check the item benefits')
})
