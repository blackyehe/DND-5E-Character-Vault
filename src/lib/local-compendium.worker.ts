import {LocalCompendiumEngine} from './local-compendium-engine'
import {localCompendiumStorage} from './local-compendium-storage'
import type {BrowseKind,BrowseQuery} from '../../shared/compendium-browse'
import type {LocalCompendiumSnapshot} from '../../shared/local-compendium'

export interface LocalWorkerCommand {id:number;action:'open'|'save'|'query'|'browse'|'identity'|'revalidate';owner:string;kind:BrowseKind;revision?:string;previous?:string;digest?:string;query?:BrowseQuery;snapshot?:LocalCompendiumSnapshot}
const engine=new LocalCompendiumEngine(localCompendiumStorage)
// Serialize storage/decode/query operations so an older open cannot replace a
// newer category while a checksum or IndexedDB read is awaiting completion.
let queue=Promise.resolve()
self.onmessage=(event:MessageEvent<LocalWorkerCommand>)=>{
 const command=event.data
 queue=queue.then(async()=>{
  try{
   let value:unknown
   if(command.action==='browse'){
    const revision=await engine.open(command.owner,command.kind)
    value={revision,...revision===command.revision?{page:engine.query(command.owner,command.kind,command.revision!,command.query!)}:{}}
   }else if(command.action==='identity')value=await engine.identity(command.owner,command.kind)
   else if(command.action==='revalidate')value={revision:await engine.revalidate(command.owner,command.kind,command.previous!,command.digest!,command.revision!),kinds:engine.storedKinds}
   else if(command.action==='save')value={revision:await engine.save(command.snapshot!,command.owner,command.kind),kinds:engine.storedKinds}
   else value=command.action==='open'?await engine.open(command.owner,command.kind):engine.query(command.owner,command.kind,command.revision!,command.query!)
   self.postMessage({id:command.id,value})
  }catch{self.postMessage({id:command.id,error:'The local catalogue is unavailable. Server browsing remains available.'})}
 })
}
