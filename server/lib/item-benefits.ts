import {itemDefinitionSnapshot} from '../../shared/item-definition'
import type {EquipmentItem} from '../../shared/character'
import {applyEntryChanges,type EntryData} from '../../shared/compendium-editing'
import {entryBenefits} from '../../shared/rule-benefits'
import {effectiveDefinition} from './definition-editions'

/** Capture the owner's configured grants when choosing/giving a template.
 * Existing character copies keep their snapshot until explicitly reviewed. */
export function withItemBenefitEdition<T extends EquipmentItem>(item:T,changes:EntryData={}):T{
 const entry=applyEntryChanges({name:item.name,workshopItem:item},changes)
 return {...item,...entry.workshopItem as EquipmentItem,name:String(entry.name??item.name),...(Array.isArray(entry.benefits)||Array.isArray((entry.workshopItem as EquipmentItem|undefined)?.benefits)?{benefits:structuredClone(entryBenefits(entry))}:{})}
}
export async function templateBenefitEdition<T extends EquipmentItem>(owner:string|undefined,id:string,item:T){
 const kind=item.magical?'magic-items':'equipment'
 const effective=await effectiveDefinition(owner,kind,{index:`workshop-item-${id}`,name:item.name,workshopItem:item})
 const definition=withItemBenefitEdition(item,effective.entry)
 return {...definition,templateBaseline:itemDefinitionSnapshot(definition)}
}
