import { ref, shallowRef } from 'vue'
import { api,ApiError } from '../lib/api'
import type { BrowseKind, BrowsePage, BrowseQuery } from '../../shared/compendium-browse'
import {invalidateLocalCompendium,localCompendiumEnabled,localCompendiumState,queryLocalCompendium,type LocalCompendiumState} from '../lib/local-compendium-client'
import {acceptCompendiumRevision} from '../lib/local-compendium-client'
import {beginForegroundWork} from '../lib/foreground-work'
import {prioritizeCompendium} from '../lib/compendium-preparation'
import {browseStartup} from '../lib/browse-startup'

/** Cache only bounded metadata pages, never full library sources or descriptions. */
export function useCompendiumBrowse(owner:()=>string|undefined=()=>undefined) {
  const response=shallowRef<BrowsePage|null>(null),loading=ref(false),error=ref('')
  const localState=ref<LocalCompendiumState>('not-saved')
  const source=ref<'device'|'server'|'memory'|''>('')
  const cache=new Map<string,{value:BrowsePage;expires:number;bytes:number;device:boolean}>()
  let controller:AbortController|undefined,sequence=0,cacheBytes=0
  let cacheOwner=owner()
  function cancel(){++sequence;controller?.abort();loading.value=false}
  function clear(){cancel();cache.clear();cacheBytes=0;response.value=null;error.value='';source.value='';localState.value='not-saved';invalidateLocalCompendium()}
  async function load(kind:BrowseKind,query:BrowseQuery,force=false) {
    cancel()
    const current=sequence
    const user=owner()
    if(user!==cacheOwner){cache.clear();cacheBytes=0;response.value=null;source.value='';cacheOwner=user}
    if(user&&localCompendiumEnabled)prioritizeCompendium(kind)
    localState.value=localCompendiumEnabled&&user?localCompendiumState(user,kind):'not-saved'
    const params=new URLSearchParams({q:query.query.trim(),page:String(query.page),facets:JSON.stringify(query.facets),items:JSON.stringify(query.items)})
    const key=`${kind}?${params}`,cacheKey=JSON.stringify([user,key]),cached=cache.get(cacheKey)
    if(!force&&cached&&cached.expires>Date.now()&&(cached.device||localState.value!=='saved')){cache.delete(cacheKey);cache.set(cacheKey,cached);response.value=cached.value;source.value='memory';error.value='';return true}
    loading.value=true;error.value='';controller=new AbortController()
    const finish=beginForegroundWork()
    try{
      if(force)invalidateLocalCompendium()
      const get=(signal:AbortSignal)=>api.get<BrowsePage>(`/api/compendium-browse/${key}`,{signal,timeoutMs:60000})
      const loaded=localCompendiumEnabled&&user&&!force?await browseStartup(signal=>queryLocalCompendium(user,kind,query,signal),get,controller.signal):{value:await get(controller.signal),device:false}
      if(current!==sequence||owner()!==user)return false
      localState.value=localCompendiumEnabled&&user?localCompendiumState(user,kind):'not-saved'
      const value=loaded.value
      source.value=loaded.device?'device':'server'
      if(!loaded.device&&user)acceptCompendiumRevision(user,value.revision)
      // A new server revision invalidates every cached category/page.
      for(const [key,entry]of cache)if(entry.value.revision!==value.revision){cache.delete(key);cacheBytes-=entry.bytes}
      const old=cache.get(cacheKey);if(old)cacheBytes-=old.bytes
      const bytes=JSON.stringify(value).length*2
      cache.set(cacheKey,{value,expires:Date.now()+30000,bytes,device:loaded.device});cacheBytes+=bytes
      while(cache.size>40||cacheBytes>4*1024*1024){const first=cache.keys().next().value!;cacheBytes-=cache.get(first)!.bytes;cache.delete(first)}
      response.value=value
      return true
    }catch(reason){if(current===sequence&&owner()===user){
      if(reason instanceof ApiError&&[401,403,404].includes(reason.status)){response.value=null;source.value='';cache.clear();cacheBytes=0;invalidateLocalCompendium()}
      error.value=reason instanceof Error?reason.message:'Could not load entries. Please try again.'
    }return false}
    finally{finish();if(current===sequence)loading.value=false}
  }
  return {response,loading,error,localState,source,load,cancel,clear}
}
