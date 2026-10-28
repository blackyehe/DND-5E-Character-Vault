import { ref, shallowRef } from 'vue'
import { api } from '../lib/api'
import type { BrowseKind, BrowsePage, BrowseQuery } from '../../shared/compendium-browse'
import {invalidateLocalCompendium,localCompendiumEnabled,localCompendiumState,queryLocalCompendium,type LocalCompendiumState} from '../lib/local-compendium-client'

/** Cache only bounded metadata pages, never full library sources or descriptions. */
export function useCompendiumBrowse(owner:()=>string|undefined=()=>undefined) {
  const response=shallowRef<BrowsePage|null>(null),loading=ref(false),error=ref('')
  const localState=ref<LocalCompendiumState>('not-saved')
  const cache=new Map<string,{value:BrowsePage;expires:number;bytes:number}>()
  let controller:AbortController|undefined,sequence=0,cacheBytes=0
  function cancel(){++sequence;controller?.abort();loading.value=false}
  function clear(){cancel();cache.clear();cacheBytes=0;response.value=null;error.value='';localState.value='not-saved';invalidateLocalCompendium()}
  async function load(kind:BrowseKind,query:BrowseQuery,force=false) {
    cancel()
    const current=sequence
    const user=owner()
    localState.value=localCompendiumEnabled&&user?localCompendiumState(user,kind):'not-saved'
    const params=new URLSearchParams({q:query.query.trim(),page:String(query.page),facets:JSON.stringify(query.facets),items:JSON.stringify(query.items)})
    const key=`${kind}?${params}`,cached=cache.get(key)
    if(!force&&cached&&cached.expires>Date.now()){cache.delete(key);cache.set(key,cached);response.value=cached.value;error.value='';return true}
    loading.value=true;error.value='';controller=new AbortController()
    try{
      if(force)invalidateLocalCompendium()
      const local=localCompendiumEnabled&&user&&!force?await queryLocalCompendium(user,kind,query,controller.signal):undefined
      if(current!==sequence)return false
      localState.value=localCompendiumEnabled&&user?localCompendiumState(user,kind):'not-saved'
      const value=local??await api.get<BrowsePage>(`/api/compendium-browse/${key}`,{signal:controller.signal,timeoutMs:60000})
      if(current!==sequence)return false
      // A new server revision invalidates every cached category/page.
      for(const [key,entry]of cache)if(entry.value.revision!==value.revision){cache.delete(key);cacheBytes-=entry.bytes}
      const old=cache.get(key);if(old)cacheBytes-=old.bytes
      const bytes=JSON.stringify(value).length*2
      cache.set(key,{value,expires:Date.now()+30000,bytes});cacheBytes+=bytes
      while(cache.size>40||cacheBytes>4*1024*1024){const first=cache.keys().next().value!;cacheBytes-=cache.get(first)!.bytes;cache.delete(first)}
      response.value=value
      return true
    }catch(reason){if(current===sequence)error.value=reason instanceof Error?reason.message:'Could not load entries. Please try again.';return false}
    finally{if(current===sequence)loading.value=false}
  }
  return {response,loading,error,localState,load,cancel,clear}
}
