import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { playUpdate } from '../../shared/rooms'
import { api } from '../lib/api'
import { resolveCharacterProgression } from '../../shared/character-progression'
import type { SrdSpell } from '../lib/srd'

import { emptyCharacter, type Character, type CharacterSummary, type EquipmentItem } from '../../shared/character'
export * from '../../shared/character'

export const useCharactersStore = defineStore('characters', () => {
  const list = ref<CharacterSummary[]>([])
  const current = ref<Character | null>(null)
  const loading = ref(false)
  const saving = ref(false)
  const saveError = ref('')
  const roomContext = ref<{ roomId: string; role: 'dm' | 'player'; preview?:boolean; championFor?:string } | null>(null)
  const editing = ref(false),rulesPending=ref(false),lastOpenMs=ref(0)
  const mutation = ref(0)
  const openingSpells=ref<Record<string,SrdSpell>>({})
  const libraryRevision=ref('')
  const canEditPermanent = computed(() => roomContext.value?.role !== 'player')
  let fetchGeneration = 0
  let previewDirty=false
  const pendingReads=new Map<string,{generation:number;promise:Promise<void>}>()
  function sheetApiPath(id:string){const scope=roomContext.value;return scope?`/api/rooms/${scope.roomId}/characters/${scope.championFor?`${scope.championFor}/champions/`:''}${id}`:`/api/characters/${id}`}

  async function fetchList() {
    loading.value = true
    try {
      list.value = await api.get<CharacterSummary[]>('/api/characters')
    } finally {
      loading.value = false
    }
  }

  async function fetchOne(id: string,options:{quick?:boolean}={}) {
    const scope = roomContext.value
    const path=sheetApiPath(id)
    const key=`${path}:${scope?.role??'owner'}:${Boolean(scope?.preview)}:${Boolean(options.quick)}`
    const pending=pendingReads.get(key)
    if(pending?.generation===fetchGeneration)return pending.promise
    const generation = ++fetchGeneration
    const initialVersion = current.value?._id === id ? current.value.updatedAt : null
    const initialMutation=mutation.value,started=performance.now()
    loading.value = true
    const promise=(async()=>{try {
      const payload = await api.get<Character|{character:Character;spells:Record<string,SrdSpell>;libraryRevision?:string}>(path+(options.quick?'?view=quick':''),{timeoutMs:12000})
      const character='character' in payload?payload.character:payload
      if (generation === fetchGeneration && initialMutation===mutation.value && !saving.value && (initialVersion === null || current.value?._id !== id || current.value.updatedAt === initialVersion)) {
        const data=resolveCharacterProgression(character)
        if(scope?.role==='player')delete data.externalImport
        // A quick refresh with the same saved version must not downgrade rules
        // already resolved for the displayed sheet.
        if(!options.quick||current.value?._id!==id||current.value.updatedAt!==data.updatedAt)current.value=data
        if('spells' in payload)openingSpells.value=payload.spells
        if('libraryRevision' in payload&&payload.libraryRevision)libraryRevision.value=payload.libraryRevision
        if(options.quick)lastOpenMs.value=performance.now()-started
        if(options.quick)previewDirty=false
      }
    } finally {if(generation===fetchGeneration)loading.value=false}})()
    pendingReads.set(key,{generation,promise})
    try {await promise}finally{if(pendingReads.get(key)?.promise===promise)pendingReads.delete(key)}
  }

  function acceptResolved(character:Character,expectedMutation:number,expectedScope:string) {
    const scope=roomContext.value,scopeKey=`${scope?.roomId??'owner'}:${scope?.role??'owner'}:${Boolean(scope?.preview)}${scope?.championFor?`:${scope.championFor}`:''}`
    if(expectedScope!==scopeKey||current.value?._id!==character._id||current.value.updatedAt!==character.updatedAt||saving.value||expectedMutation!==mutation.value||scope?.preview&&previewDirty)return false
    const data=resolveCharacterProgression(character)
    if(scope?.role==='player')delete data.externalImport
    if(JSON.stringify(data)===JSON.stringify(current.value))return true
    if(editing.value){rulesPending.value=true;return false}
    current.value=data
    rulesPending.value=false
    return true
  }

  async function create(payload: Partial<Character>) {
    const body = { ...emptyCharacter(), ...payload }
    const created = await api.post<Character>('/api/characters', body)
    list.value.unshift({
      _id: created._id,
      meta: created.meta,
      updatedAt: created.updatedAt,
    })
    return created
  }

  async function update(id: string, patch: Partial<Character>) {
    mutation.value++
    if(roomContext.value?.preview){
      if(current.value?._id!==id)throw new Error('Open a character before trying the preview.')
      const data=resolveCharacterProgression({...current.value,...patch})
      delete data.externalImport
      previewDirty=true;current.value=data;saveError.value=''
      return data
    }
    saving.value = true; saveError.value = ''
    try {
      const scope = roomContext.value
      const updated = scope?.role === 'player'
        ? await api.patch<Character>(`/api/rooms/${scope.roomId}/characters/${id}/play`, playUpdate(current.value!, patch))
        : await api.patch<Character>(`/api/characters/${id}`, { ...patch, ...(current.value?._id === id ? { expectedUpdatedAt: current.value.updatedAt } : {}) })
      if (current.value?._id === id) current.value = resolveCharacterProgression(updated)
      rulesPending.value=false
      return updated
    } catch (error) {
      saveError.value = error instanceof Error ? error.message : 'Could not save changes. Please try again.'
      throw error
    } finally { saving.value = false }
  }

  async function giveItem(id:string,item:EquipmentItem,requestId:string,remember=false){
    if(roomContext.value?.role==='player')throw new Error('Only the DM can give items.')
    mutation.value++;saving.value=true;saveError.value=''
    try{
      const result=await api.post<{character:Character;message:string}>(`/api/characters/${id}/items`,{item,requestId,remember})
      if(current.value?._id===id)current.value=resolveCharacterProgression(result.character)
      return result
    }catch(error){saveError.value=error instanceof Error?error.message:'Could not give this item.';throw error}finally{saving.value=false}
  }

  async function remove(id: string) {
    await api.delete(`/api/characters/${id}`)
    list.value = list.value.filter((c) => c._id !== id)
  }

  async function duplicate(id: string) {
    const copy = await api.post<Character>(`/api/characters/${id}/duplicate`)
    list.value.unshift({ _id: copy._id, meta: copy.meta, updatedAt: copy.updatedAt })
    return copy
  }

  async function importCharacter(data: unknown) {
    const created = await api.post<Character>('/api/characters/import', data)
    list.value.unshift({ _id: created._id, meta: created.meta, updatedAt: created.updatedAt })
    return created
  }

  return {
    list,
    current,
    loading,
    saving,
    saveError,
    roomContext,
    sheetApiPath,
    editing,rulesPending,mutation,lastOpenMs,acceptResolved,openingSpells,libraryRevision,
    canEditPermanent,
    fetchList,
    fetchOne,
    create,
    update,
    giveItem,
    remove,
    duplicate,
    importCharacter,
  }
})
