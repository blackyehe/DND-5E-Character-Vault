<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { api } from '../../lib/api'
import { workshopProblems, type WorkshopDraft } from '../../lib/homebrew-workshop'
export interface WorkshopPack {id:string;filename:string;hash:string;entries:string[]}
export interface WorkshopLibraryInfo {packs:WorkshopPack[];rules:{id:string;revision:number;index:string;previousIndexes?:string[]}[];warnings:string[]}
const props=defineProps<{draft:WorkshopDraft}>()
const emit=defineEmits<{close:[];saved:[draft:WorkshopDraft,message:string]}>()
const library=ref<WorkshopLibraryInfo>({packs:[],rules:[],warnings:[]})
const panel=ref<HTMLElement|null>(null),previousFocus=document.activeElement as HTMLElement|null
onMounted(()=>panel.value?.focus())
onUnmounted(()=>previousFocus?.isConnected&&previousFocus.focus())
function trap(event:KeyboardEvent){if(event.key!=='Tab'||!panel.value)return;const nodes=[...panel.value.querySelectorAll<HTMLElement>('button:not(:disabled),select:not(:disabled),input:not(:disabled)')],first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&(document.activeElement===first||document.activeElement===panel.value)){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}}
const target=ref('new'),filename=ref(''),busy=ref(false),loading=ref(true),error=ref('')
const pack=computed(()=>library.value.packs.find(p=>p.id===target.value))
const originals=computed(()=>library.value.packs.filter(p=>p.entries.includes(props.draft.imported?.index??'')))
const problems=computed(()=>workshopProblems(props.draft))
onMounted(async()=>{try{library.value=await api.get<WorkshopLibraryInfo>('/api/workshop/library');target.value=props.draft.published?.packId??originals.value[0]?.id??'new';filename.value=`${props.draft.source.replace(/[<>:"/\\|?*]/g,'-')||'My Homebrew'}.orcbrew`}catch(e){error.value=(e as Error).message}finally{loading.value=false}})
async function publish(){if(busy.value||problems.value.length)return;busy.value=true;error.value=''
  try{const result=await api.post<{draft:WorkshopDraft;updates:{updated:number;review:number;deferred:number}}>('/api/workshop/publish',{draft:props.draft,target:target.value==='new'?{filename:filename.value}:{packId:pack.value?.id,expectedHash:pack.value?.hash},expectedRevision:props.draft.published?.revision??0})
    const {updated,review,deferred}=result.updates
    emit('saved',result.draft,`Saved revision ${result.draft.published!.revision}. ${updated} character${updated===1?'':'s'} updated.${review?` ${review} need a review.`:''}${deferred?' Some characters were busy; their rules will refresh when opened.':''}`)
    try{localStorage.setItem('codex:workshop-revision',String(Date.now()))}catch{/* Other tabs refresh when focused. */}
    window.dispatchEvent(new Event('codex:workshop-published'))
  }catch(e){error.value=(e as Error).message}finally{busy.value=false}
}
</script>
<template><div class="hw-modal-backdrop" @click.self="!busy&&emit('close')"><section ref="panel" tabindex="-1" @keydown="trap" class="hw-modal hw-panel" role="dialog" aria-modal="true" aria-labelledby="workshop-save-title" @keydown.esc="!busy&&emit('close')"><header class="hw-between"><h2 id="workshop-save-title">Save to a pack</h2><button class="hw-icon-button" :disabled="busy" aria-label="Close pack saving" @click="emit('close')">×</button></header><p class="hw-hint">{{draft.name}} · {{draft.kind}} · {{draft.published?`Revision ${draft.published.revision+1}`:'First saved revision'}}</p><p v-if="loading" role="status">Loading your packs…</p><template v-else><label>Where to save<select v-model="target" :disabled="busy"><optgroup v-if="originals.length" label="Original imported files"><option v-for="p in originals" :key="p.id" :value="p.id">{{p.filename}}</option></optgroup><optgroup label="Another pack"><option v-for="p in library.packs.filter(p=>!originals.some(o=>o.id===p.id))" :key="p.id" :value="p.id">{{p.filename}}</option></optgroup><option value="new">Create a new pack…</option></select></label><label v-if="target==='new'">New pack filename<input v-model="filename" :disabled="busy" maxlength="255" placeholder="My Homebrew.orcbrew"/></label><aside class="hw-callout"><strong>{{originals.some(p=>p.id===target)?'Update this imported file':'Save this definition in another pack'}}</strong><p>{{originals.some(p=>p.id===target)?'The selected definition is updated. Other entries and unsupported fields are preserved.':'The original imported file is kept. Characters linked to this definition will still follow the saved revision.'}}</p><p>Existing characters receive changed rules, granted features, slots, and resource maximums. HP, spent uses, equipment, and selected choices are preserved; conflicts are flagged.</p></aside><ul v-if="problems.length" class="hw-alert"><li v-for="problem in problems" :key="problem">{{problem}}</li></ul><p v-if="error" class="hw-alert" role="alert">{{error}}</p><footer class="hw-actions"><button class="hw-button" :disabled="busy" @click="emit('close')">Keep editing</button><button class="hw-button hw-button-primary" :disabled="busy||loading||!!problems.length||target==='new'&&!filename.trim()||target!=='new'&&!pack" @click="publish">{{busy?'Saving rules & updating characters…':'Save rules & update characters'}}</button></footer></template></section></div></template>
