import {MANUAL_OPTION_KINDS} from '../../shared/option-kinds'
import {entryBenefits} from '../../shared/rule-benefits'
import type {CharacterRuleCatalog} from './workshop-rules'
/** Picker payload: retain selectable rules, omit raw pack trees and unrelated fields. */
export function manualOptionChoices(catalog:CharacterRuleCatalog){
 return Object.fromEntries(MANUAL_OPTION_KINDS.map(kind=>[kind,(catalog[kind]??[]).map(entry=>{
  const raw=entry.details as Record<string,unknown>|undefined,body=entry.optionBuilder as {prerequisites?:string;choiceGroup?:unknown}|undefined
  return {index:entry.index,name:entry.name,description:entry.description,displayName:entry.displayName,sourcePack:entry.sourcePack,contentKey:entry.contentKey,aliases:entry.aliases,optionId:entry.optionId,benefits:entryBenefits(entry),prerequisites:body?.prerequisites??entry.prerequisites??raw?.[':prereqs']??raw?.[':prerequisites'],...(body?.choiceGroup?{optionBuilder:{choiceGroup:body.choiceGroup}}:{})}
 })]))
}
