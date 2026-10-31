// Shared by API requests and navigation. Background preparation never counts as
// foreground work and must yield before a foreground fetch is dispatched.
let active=0
const listeners=new Set<(busy:boolean)=>void>()
export const foregroundBusy=()=>active>0
export function onForegroundWork(listener:(busy:boolean)=>void){listeners.add(listener);return ()=>{listeners.delete(listener)}}
export function beginForegroundWork(){
 active++;for(const listener of listeners)listener(true)
 let ended=false
 return ()=>{if(ended)return;ended=true;active--;if(!active)for(const listener of listeners)listener(false)}
}
