import {LocalCompendiumEngine} from './local-compendium-engine'
import {localCompendiumStorage} from './local-compendium-storage'
import type {BrowseKind,BrowseQuery} from '../../shared/compendium-browse'
import type {LocalCompendiumSnapshot} from '../../shared/local-compendium'

export interface LocalWorkerCommand {id:number;action:'open'|'save'|'query';owner:string;kind:BrowseKind;revision?:string;query?:BrowseQuery;snapshot?:LocalCompendiumSnapshot}
const engine=new LocalCompendiumEngine(localCompendiumStorage)
// Serialize storage/decode/query operations so an older open cannot replace a
// newer category while a checksum or IndexedDB read is awaiting completion.
let queue=Promise.resolve()
self.onmessage=(event:MessageEvent<LocalWorkerCommand>)=>{
 const command=event.data
 queue=queue.then(async()=>{
  try{
   const value=command.action==='open'?await engine.open(command.owner,command.kind):command.action==='save'?await engine.save(command.snapshot!,command.owner,command.kind):engine.query(command.owner,command.kind,command.revision!,command.query!)
   self.postMessage({id:command.id,value})
  }catch{self.postMessage({id:command.id,error:'The local catalogue is unavailable. Server browsing remains available.'})}
 })
}
