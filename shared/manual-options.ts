import type {CharacterFeature} from './character'
import {isManualOptionKind} from './option-kinds'
/** Manual class/table grants remain separate from earned feat opportunities. */
export function manualOptionProblem(value:unknown):string|undefined{
 if(!value||typeof value!=='object')return 'A saved invocation or boon is unreadable. Remove it or restore its draft.'
 const feature=value as CharacterFeature,definition=feature.definition
 if(!definition||definition.version!==1||!isManualOptionKind(definition.kind)||typeof definition.index!=='string'||!definition.index||definition.index.length>300||typeof feature.name!=='string'||!feature.name.trim()||typeof feature.description!=='string')return 'A saved invocation or boon is missing its definition. Restore its pack or remove that selection.'
 if(definition.choiceIds!==undefined&&(!Array.isArray(definition.choiceIds)||definition.choiceIds.length>100||definition.choiceIds.some(id=>typeof id!=='string'||id.length>100)))return 'Check the saved choice IDs.'
 if(definition.grantConfirmed!==true)return 'Confirm that your class or table grants each selected invocation or boon.'
 if(!Number.isInteger(feature.level)||feature.level!<1||feature.level!>20)return 'Character options need an acquired level from 1 to 20.'
}
