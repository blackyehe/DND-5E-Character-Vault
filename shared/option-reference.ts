/** IDs select rules. Labels are used only for unambiguous legacy recovery. */
export interface OptionIdentity {index:string;name:string;displayName?:unknown;aliases?:unknown;sourcePack?:unknown;optionId?:unknown}
const normalized=(value:unknown)=>typeof value==='string'?value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g,' '):''
export function optionHasId(entry:OptionIdentity,index:string){return entry.index===index||Array.isArray(entry.aliases)&&entry.aliases.includes(index)}
export function optionLabelMatches(entry:OptionIdentity,label:string){const key=normalized(label);return !!key&&[entry.name,entry.displayName,entry.sourcePack?`${entry.name} — ${entry.sourcePack}`:undefined].some(value=>normalized(value)===key)}
export function selectedOption<T extends OptionIdentity>(entries:readonly T[],index:string|undefined,label:string):T|undefined{const matches=entries.filter(entry=>index?optionHasId(entry,index):optionLabelMatches(entry,label));return matches.length===1?matches[0]:undefined}
export function sameOptionIdentity(a:OptionIdentity,b:OptionIdentity){return typeof a.optionId==='string'&&typeof b.optionId==='string'?a.optionId===b.optionId:optionHasId(a,b.index)||optionHasId(b,a.index)}
