<script setup lang="ts">
import {onMounted,onBeforeUnmount,ref,watch} from 'vue'
import {api} from '../../lib/api'
import {useAuthStore} from '../../stores/auth'
import type {CompendiumKind} from '../../../shared/compendium-editing'
import DefinitionChangeReview from '../compendium/DefinitionChangeReview.vue'
type Update={kind:CompendiumKind;index:string;name:string;missing?:boolean}
const props=defineProps<{characterId:string;roomId?:string;canApply:boolean;disabled?:boolean}>()
const emit=defineEmits<{applied:[]}>(),auth=useAuthStore()
const updates=ref<Update[]>([]),selected=ref<Update>(),error=ref(''),busy=ref(false),reviewBusy=ref(false)
let generation=0,controller:AbortController|undefined,needsCheck=false
async function load(){
 if(props.disabled||reviewBusy.value){needsCheck=true;return}
 needsCheck=false
 const run=++generation;controller?.abort();controller=new AbortController();busy.value=true;error.value=''
 const path=props.roomId?`/api/rooms/${props.roomId}/characters/${props.characterId}/rule-updates`:`/api/compendium/pending/${props.characterId}`
 try{const rows=await api.get<Update[]>(path,{signal:controller.signal,timeoutMs:60000});if(run===generation){updates.value=rows;if(selected.value&&!rows.some(r=>r.kind===selected.value?.kind&&r.index===selected.value.index))selected.value=undefined}}
 catch(e){if(run===generation&&!controller.signal.aborted)error.value=(e as Error).message}
 finally{if(run===generation)busy.value=false}
}
const refresh=()=>{if(document.visibilityState==='visible')void load()}
const storage=(event:StorageEvent)=>{if(event.key==='codex:workshop-revision')refresh()}
function applied(){updates.value=updates.value.filter(row=>row.kind!==selected.value?.kind||row.index!==selected.value.index);selected.value=undefined;emit('applied')}
watch(()=>[props.characterId,props.roomId,auth.user?.id],()=>{++generation;controller?.abort();updates.value=[];selected.value=undefined;void load()},{immediate:true})
watch(()=>props.disabled,disabled=>{if(!disabled&&needsCheck)void load()})
onMounted(()=>{window.addEventListener('focus',refresh);window.addEventListener('codex:library-changed',refresh);window.addEventListener('storage',storage)})
onBeforeUnmount(()=>{++generation;controller?.abort();window.removeEventListener('focus',refresh);window.removeEventListener('codex:library-changed',refresh);window.removeEventListener('storage',storage)})
</script>
<template>
 <details v-if="updates.length||error" class="sheet-panel" style="margin-bottom:16px" aria-label="Saved definition updates">
  <summary>Saved rule updates <span v-if="updates.length">· {{updates.length}}</span></summary>
  <p class="sheet-small">Your current rules remain in use until an update is reviewed and applied. HP, spent uses and player choices are preserved.</p>
  <p v-if="error" class="sheet-small" role="status">Could not check saved definitions: {{error}}</p>
  <ul><li v-for="row in updates" :key="row.kind+row.index"><strong>{{row.name}}</strong> — {{row.missing?'Source unavailable; keeping approved rules.':'A saved definition needs review.'}} <button v-if="canApply&&!row.missing" type="button" class="sheet-button sheet-small-button" :disabled="disabled||reviewBusy" @click="selected=row">Review changes</button></li></ul>
  <p v-if="!canApply" class="sheet-small">Your DM can review and apply these changes.</p>
  <button type="button" class="sheet-button sheet-small-button" :disabled="disabled||busy||reviewBusy" @click="load">{{busy?'Checking…':'Check for updates'}}</button>
  <DefinitionChangeReview v-if="selected&&canApply" :kind="selected.kind" :index="selected.index" :character-id="characterId" :disabled="disabled" @busy="reviewBusy=$event" @applied="applied" />
 </details>
</template>
