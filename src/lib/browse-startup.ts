/** Give a verified device index a short head start. A slow validation must not
 * delay starting the ordinary authoritative browse by its entire 1.5s budget.
 * At most one server request is started, and the losing read is cancelled. */
export async function browseStartup<T>(probe:(signal:AbortSignal)=>Promise<T|undefined>,server:(signal:AbortSignal)=>Promise<T>,signal:AbortSignal,headStartMs=200):Promise<{value:T;device:boolean}>{
 const localController=new AbortController(),serverController=new AbortController()
 let task:Promise<{value:T;device:boolean}>|undefined,timer:ReturnType<typeof setTimeout>|undefined,onAbort=()=>{}
 let resolveServer!:(value:{value:T;device:boolean}|PromiseLike<{value:T;device:boolean}>)=>void,rejectServer!:(error:unknown)=>void
 const ordinary=new Promise<{value:T;device:boolean}>((resolve,reject)=>{resolveServer=resolve;rejectServer=reject})
 const startServer=()=>{
  if(!task&&!signal.aborted){task=Promise.resolve().then(()=>server(AbortSignal.any([signal,serverController.signal]))).then(value=>({value,device:false}));task.then(resolveServer,rejectServer)}
  return ordinary
 }
 const cancelled=new Promise<never>((_resolve,reject)=>{onAbort=()=>reject(new Error('Browsing was cancelled.'));signal.addEventListener('abort',onAbort,{once:true})})
 try{
  if(signal.aborted)throw Error('Browsing was cancelled.')
  const local=Promise.resolve().then(()=>probe(AbortSignal.any([signal,localController.signal]))).then(value=>value===undefined?startServer():{value,device:true}).catch(()=>startServer())
  timer=setTimeout(startServer,headStartMs)
  return await Promise.race([local,ordinary,cancelled])
 }finally{clearTimeout(timer);signal.removeEventListener('abort',onAbort);localController.abort();serverController.abort()}
}
