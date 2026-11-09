import type {EquipmentItem} from '../../shared/character'
import {applyEntryChanges,type EntryData} from '../../shared/compendium-editing'
import {entryBenefits} from '../../shared/rule-benefits'
import {CustomContent} from '../models/CustomContent'

/** Capture the owner's configured grants when choosing/giving a template.
 * Existing character copies keep their snapshot until explicitly reviewed. */
export function withItemBenefitEdition<T extends EquipmentItem>(item:T,changes:EntryData={}):T{
 const entry=applyEntryChanges({name:item.name,workshopItem:item},changes)
 if(!Array.isArray(entry.benefits)&&!Array.isArray((entry.workshopItem as EquipmentItem|undefined)?.benefits))return item
 return {...item,benefits:structuredClone(entryBenefits(entry))}
}
export async function templateBenefitEdition<T extends EquipmentItem>(owner:string|undefined,id:string,item:T){
 const kind=item.magical?'magic-items':'equipment'
 const edit=await CustomContent.findOne({userId:owner,type:'compendium-edit','data.kind':kind,'data.index':`workshop-item-${id}`}).select('data.changes').lean()
 return withItemBenefitEdition(item,(edit?.data as {changes?:EntryData}|undefined)?.changes)
}
