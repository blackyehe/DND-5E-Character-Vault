import type {EquipmentItem} from './character'
export const ITEM_DEFINITION_FIELDS=['name','weight','category','tags','rarity','value','attunementRequirement','description','armor','weapon','magicBonus','kind','magical','requiresAttunement','effects','benefits','trackers'] as const
/** Source values only: quantities, equipment state and personal notes stay local. */
export function itemDefinitionSnapshot(item:Partial<EquipmentItem>):Partial<EquipmentItem>{
 return JSON.parse(JSON.stringify(Object.fromEntries(ITEM_DEFINITION_FIELDS.flatMap(key=>item[key]===undefined?[]:[[key,item[key]]]))))
}
