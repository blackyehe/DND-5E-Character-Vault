import {subclassParent} from './subclass-identity'

export const CREATION_SELECTION_KINDS=['classes','races','backgrounds','subraces','subclasses','feats','languages','spells'] as const
export type CreationKind=typeof CREATION_SELECTION_KINDS[number]
/** Identity and picker/filter data only. Never use these rows as character rules. */
export interface CreationIdentity {index:string;name:string;url:string;displayName?:string;contentKey?:string;sourcePack?:string;aliases?:string[]}
export interface CreationSelection extends CreationIdentity {
 selectionOnly:true
 homebrew:true
 class?:string
 race?:{index:string}
 level?:number
 classes?:CreationIdentity[]
}
export interface CreationSelections {revision:string;options:Record<CreationKind,CreationSelection[]>}
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
export function creationSelection(kind:CreationKind,entry:Record<string,unknown>):CreationSelection {
 const result:CreationSelection={index:String(entry.index),name:String(entry.name),url:typeof entry.url==='string'?entry.url:'',selectionOnly:true,homebrew:true}
 for(const key of ['displayName','contentKey','sourcePack'] as const)if(typeof entry[key]==='string')result[key]=entry[key]
 if(Array.isArray(entry.aliases))result.aliases=entry.aliases.filter((v):v is string=>typeof v==='string')
 if(kind==='subclasses')result.class=subclassParent(entry as unknown as Parameters<typeof subclassParent>[0])
 if(kind==='subraces'){
  const native=object(object(entry.optionBuilder).subrace),race=entry.race
  const parent=typeof native.parentIndex==='string'?native.parentIndex:typeof race==='string'?race:object(race).index
  if(typeof parent==='string')result.race={index:parent}
 }
 if(kind==='spells'){
  result.level=Number(entry.level)
  result.classes=Array.isArray(entry.classes)?entry.classes.map(c=>{const r=object(c);return {index:String(r.index),name:String(r.name??r.index),url:''}}):[]
 }
 return result
}
