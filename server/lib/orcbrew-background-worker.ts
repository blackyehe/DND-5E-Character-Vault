import {parentPort} from 'node:worker_threads'
import {inspectOrcbrew} from './orcbrew'
parentPort!.once('message',(source:string)=>{
 try{
  const parsed=inspectOrcbrew(source),data=new TextEncoder().encode(JSON.stringify(parsed))
  if(data.byteLength>64*1024*1024)throw Error('Parsed output limit')
  parentPort!.postMessage({data},[data.buffer])
 }catch{parentPort!.postMessage({error:'Pack parsing was unavailable'})}
 parentPort!.close()
})
