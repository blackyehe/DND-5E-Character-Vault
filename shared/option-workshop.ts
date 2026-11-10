import {subraceOptionProblem} from './subrace-options'
import {choiceGroupProblem} from './choice-groups'
import {entryOptionDraft,type OptionBuilder} from './entry-builders'
import type {EntryData} from './compendium-editing'
import {OPTION_KINDS,type OptionKind} from './option-kinds'
export {OPTION_KINDS,optionTitle,type OptionKind} from './option-kinds'
export interface OptionDraft {version:1;id:string;kind:OptionKind;source:string;body:OptionBuilder;benefits:unknown[];updatedAt:string;published?:{revision:number;index:string;packId:string;packHash:string;definitionRevision?:number}}
export const optionDraftStorageKey=(owner:string)=>`codex:option-workshop:v1:${owner}`
export function newOptionDraft(kind:OptionKind):OptionDraft{return {version:1,id:crypto.randomUUID(),kind,source:'My Homebrew',body:{...entryOptionDraft({name:''}),...(kind==='subraces'?{subrace:{parentIndex:'',parentName:'',bonuses:{str:0,dex:0,con:0,int:0,wis:0,cha:0},speed:null}}:{}),...(kind==='selections'?{choiceGroup:{version:1 as const,choose:1,options:[]}}:{})},benefits:[],updatedAt:new Date().toISOString()}}
export function optionDraftEntry(draft:OptionDraft):EntryData{return {name:draft.body.name,index:`option-${draft.id}`,optionBuilder:draft.body,benefits:draft.benefits}}
/** Recover incomplete device drafts; malformed data must never replace storage. */
export function restoreOptionDraft(value:unknown):OptionDraft{
 if(!value||typeof value!=='object')throw new Error('Invalid option draft')
 const d=value as OptionDraft,b=d.body
 if(d.version!==1||typeof d.id!=='string'||!(/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(d.id))||!OPTION_KINDS.includes(d.kind)||typeof d.source!=='string'||typeof d.updatedAt!=='string'||!Array.isArray(d.benefits)||!b)throw new Error('Invalid option draft')
 for(const field of ['name','description','prerequisites','featureName','featureDescription','script','languageType','equipment'] as const)if(typeof b[field]!=='string')throw new Error('Invalid option draft fields')
 if(!Array.isArray(b.options)||b.options.some(v=>typeof v!=='string')||!Array.isArray(b.typicalSpeakers)||b.typicalSpeakers.some(v=>typeof v!=='string')||!Number.isInteger(b.choose)||b.choose<1||b.choose>200)throw new Error('Invalid option choices')
 if(b.subrace&&subraceOptionProblem(b.subrace,false))throw new Error('Invalid subrace fields')
 if(b.choiceGroup&&choiceGroupProblem(b.choiceGroup,false))throw new Error('Invalid choice tree')
 if(d.published&&(!Number.isInteger(d.published.revision)||d.published.revision<1||typeof d.published.index!=='string'||typeof d.published.packId!=='string'||!/^[a-f0-9]{24}$/i.test(d.published.packId)||typeof d.published.packHash!=='string'||!/^[a-f0-9]{64}$/i.test(d.published.packHash)))throw new Error('Invalid saved option identity')
 return JSON.parse(JSON.stringify(d)) as OptionDraft
}
