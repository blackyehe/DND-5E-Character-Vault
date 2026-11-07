import {api} from './api'
import {CREATION_SELECTION_KINDS,type CreationSelections,type CreationKind,type CreationSelection} from '../../shared/creation-selection'
import type {CreationOptions} from './srd'

/** Per-builder, never shared across accounts. A full definition is only usable
 * with the exact revision returned alongside this builder's selection lists. */
export function creationSelectionClient(owner:()=>string|undefined=()=>undefined){
 let current:CreationSelections|undefined,epoch=0
 let account:string|undefined
 const pending=new Map<string,Promise<unknown>>()
 function reset(){++epoch;current=undefined;pending.clear()}
 async function load(){
  reset();const run=epoch,user=owner(),value=await api.get<CreationSelections>('/api/content/creation-selections',{timeoutMs:30000})
  if(run!==epoch||user!==owner())throw Error('Character library loading was cancelled.')
  if(!value||!/^[a-f0-9]{64}$/.test(value.revision)||!value.options||!CREATION_SELECTION_KINDS.every(kind=>Array.isArray(value.options[kind])&&value.options[kind].every(entry=>entry&&typeof entry.index==='string'&&typeof entry.name==='string'&&typeof entry.url==='string'&&entry.selectionOnly===true)))throw Error('Character selection lists could not be read.')
  current=value;account=user;return value.options
 }
 async function definition<K extends CreationKind>(kind:K,entry:CreationSelection):Promise<CreationOptions[K][number]>{
  if(!current||account!==owner())throw Error('Reload the character library before choosing rules.')
  const run=epoch,key=kind+':'+entry.index,revision=current.revision
  let task=pending.get(key)
  if(!task){task=api.get(`/api/content/creation-definitions/${kind}/${encodeURIComponent(entry.index)}?revision=${revision}`,{timeoutMs:30000});pending.set(key,task);task.catch(()=>{if(pending.get(key)===task)pending.delete(key)})}
  const value=await task as CreationOptions[K][number]
  if(run!==epoch||account!==owner())throw Error('Character library changed while loading rules.')
  if(value.index!==entry.index||'selectionOnly'in value)throw Error('The complete character definition could not be read.')
  return value
 }
 async function featDefinitions(){
  if(!current||account!==owner())throw Error('Reload the character library before browsing feats.')
  const run=epoch,revision=current.revision,value=await api.get<CreationOptions['feats']>(`/api/content/creation-definitions/feats?revision=${revision}`,{timeoutMs:30000})
  if(run!==epoch||account!==owner())throw Error('Character library changed while loading feats.')
  return value
 }
 return{load,definition,featDefinitions,reset}
}
