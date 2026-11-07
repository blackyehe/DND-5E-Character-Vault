import type {Character} from '../../shared/character'
import type {CharacterRuleLibrary} from './workshop-rules'
import {selectedOption,optionHasId,sameOptionIdentity,optionLabelMatches} from '../../shared/option-reference'
import {cloneEntry,type CompendiumDefinition} from '../../shared/compendium-editing'
import {isOptionKind,isFeatureOptionKind,isManualOptionKind,optionTitle} from '../../shared/option-kinds'
import {subraceMatchesRace} from '../../shared/subrace-options'
import {choiceSelectionProblem,type ChoiceGroup} from '../../shared/choice-groups'
import {manualOptionProblem} from '../../shared/manual-options'
/** Capture authored grants once on selection. Later pack edits require review. */
export function pinSelectedOptions(character:Character,library:CharacterRuleLibrary,before?:Character):Character{
 for(const feature of character.features)if(isManualOptionKind(feature.definition?.kind)){const issue=manualOptionProblem(feature);if(issue)throw new Error(issue)}
 const selections=[...(character.meta.subraceIndex?[{kind:'subraces' as const,index:character.meta.subraceIndex,label:character.meta.subrace}]:[]),...(character.meta.backgroundIndex?[{kind:'backgrounds' as const,index:character.meta.backgroundIndex,label:character.meta.background}]:[]),...character.features.flatMap(f=>f.definition?.version===1&&isFeatureOptionKind(f.definition.kind)?[{kind:f.definition.kind,index:f.definition.index,label:f.name}]:[])]
 const previous=before?.compendiumRules??[]
 const matches=(d:CompendiumDefinition,s:typeof selections[number])=>{
  if(d.kind!==s.kind)return false
  const identity={...d.entry,index:d.index,name:String(d.entry.name)},current=selectedOption(library.catalog[s.kind]??[],s.index,s.label)
  return optionHasId(identity,s.index)||!!current&&sameOptionIdentity(identity,current)
 }
 const retained=(character.compendiumRules??[]).filter(d=>!isOptionKind(d.kind)||selections.some(s=>matches(d,s))||d.kind==='subraces'&&!character.meta.subraceIndex&&optionLabelMatches({...d.entry,index:d.index,name:String(d.entry.name)},character.meta.subrace)||d.kind==='languages'&&character.proficiencies.languages.some(label=>optionLabelMatches({...d.entry,index:d.index,name:String(d.entry.name)},label))||isManualOptionKind(d.kind)&&character.features.some(f=>!f.definition&&optionLabelMatches({...d.entry,index:d.index,name:String(d.entry.name)},f.name))).map(d=>{
  const changed=selections.filter(s=>matches(d,s)&&!optionHasId({...d.entry,index:d.index,name:String(d.entry.name)},s.index))
  if(!changed.length)return d
  // Identity metadata may advance while the approved rule values stay pinned.
  const aliases=[...new Set([...(Array.isArray(d.entry.aliases)?d.entry.aliases:[]),...changed.map(s=>s.index)])]
  return {...d,before:{...d.before,aliases},entry:{...d.entry,aliases}}
 })
 for(const selected of selections){
  if(retained.some(d=>d.kind===selected.kind&&(d.index===selected.index||optionHasId({...d.entry,index:d.index,name:String(d.entry.name)},selected.index))))continue
  const entry=selectedOption(library.catalog[selected.kind]??[],selected.index,selected.label)
  if(!entry){
   if(!selected.index.startsWith('homebrew-'))continue // SRD/custom labels have no imported grants.
   const unchanged=selected.kind==='subraces'?before?.meta.subraceIndex===selected.index:selected.kind==='backgrounds'?before?.meta.backgroundIndex===selected.index:before?.features.some(f=>f.definition?.kind===selected.kind&&f.definition.index===selected.index)
   if(!unchanged)throw new Error(`The selected ${optionTitle(selected.kind)} is unavailable or ambiguous. Refresh the choices before saving.`)
   continue
  }
  if(selected.kind==='subraces'&&entry.optionId){const parent=selectedOption(library.catalog.races,character.meta.raceIndex,character.meta.race)??{index:character.meta.raceIndex??character.meta.race.toLowerCase(),name:character.meta.race};if(!subraceMatchesRace(entry,parent))throw new Error('This subrace belongs to a different or unavailable parent race. Choose its parent first.')}
  // Legacy descriptive imports keep their existing grants and manual choices.
  if(!entry.optionId&&!(selected.kind==='selections'&&(entry.optionBuilder as {choiceGroup?:unknown}|undefined)?.choiceGroup))continue
  const saved=previous.find(d=>matches(d,selected))
  if(saved){retained.push(saved);continue}
  const {details,...values}=entry,copy=cloneEntry(values)
  retained.push({kind:selected.kind,index:selected.index,revision:0,before:copy,entry:cloneEntry(copy)} as CompendiumDefinition)
 }
 if(character.meta.subraceIndex&&(character.meta.subraceIndex!==before?.meta.subraceIndex||character.meta.raceIndex!==before?.meta.raceIndex||character.meta.race!==before?.meta.race)){
  const id=character.meta.subraceIndex,entry=selectedOption(library.catalog.subraces??[],id,character.meta.subrace)??retained.find(d=>d.kind==='subraces'&&optionHasId({...d.entry,index:d.index,name:String(d.entry.name)},id))?.entry,parent=selectedOption(library.catalog.races,character.meta.raceIndex,character.meta.race)??{index:character.meta.raceIndex??character.meta.race.toLowerCase(),name:character.meta.race}
  if(entry?.optionId&&!subraceMatchesRace(entry,parent))throw new Error('This subrace belongs to a different parent race. Choose its parent first.')
 }
 const manualSeen=new Set<string>();for(const f of character.features.filter(f=>isManualOptionKind(f.definition?.kind))){const def=f.definition!,entry=selectedOption(library.catalog[def.kind]??[],def.index,f.name),id=def.kind+':'+(entry?.optionId??entry?.index??def.index);if(manualSeen.has(id))throw new Error('The same character option is selected more than once.');manualSeen.add(id)}
 for(const feature of character.features.filter(f=>f.definition?.kind==='selections')){
  const def=feature.definition!,saved=retained.find(d=>d.kind==='selections'&&optionHasId({...d.entry,index:d.index,name:String(d.entry.name)},def.index)),entry=saved?.entry??selectedOption(library.catalog.selections??[],def.index,feature.name)
  const group=(entry?.optionBuilder as {choiceGroup?:ChoiceGroup}|undefined)?.choiceGroup
  if(group){const issue=choiceSelectionProblem(group,def.choiceIds);if(issue)throw new Error(issue)}
  else if(def.choiceIds?.length)throw new Error('This source has no structured choices. Restore the saved group or remove the selection.')
 }
 return {...character,...(retained.length||character.compendiumRules?{compendiumRules:retained}:{})}
}
