<script setup lang="ts">
import { ref, watch } from 'vue'
import { api } from '../lib/api'
import type { CharacterSummary } from '../../shared/character'
const props=defineProps<{ level: number;roomId?:string;characterId?:string }>()
const champions=ref<CharacterSummary[]>([]), loading=ref(true), error=ref(false)
async function load() {
  loading.value=true;error.value=false
  try { champions.value=await api.get<CharacterSummary[]>(props.roomId&&props.characterId?`/api/rooms/${props.roomId}/characters/${props.characterId}/champions`:'/api/characters/champions') }
  catch { error.value=true }
  finally { loading.value=false }
}
watch(()=>[props.roomId,props.characterId],()=>{champions.value=[];void load()},{immediate:true})
const championLink=(id:string)=>props.roomId&&props.characterId?`/rooms/${props.roomId}/characters/${props.characterId}/champions/${id}`:`/characters/${id}`
</script>

<template>
  <section class="shadow-champions" aria-label="Shadow Champions available"><h3>Shadow Champions available</h3><p v-if="level<5">Manifest the Dead unlocks at class level 5. You can browse champion sheets now.</p><p v-if="loading">Loading champion sheets…</p><p v-else-if="error">Champion sheets could not be loaded. <button type="button" @click="load">Try again</button></p><p v-else-if="!champions.length">No champion sheets yet. Import a character and mark it as a Shadow Champion in Edit character.</p><a v-for="champion in champions" :key="champion._id" :href="championLink(champion._id)" target="_blank" rel="noopener"><strong>{{champion.meta.name}} <span aria-hidden="true">↗</span></strong><small>Level {{champion.meta.level}} · {{champion.meta.klass}}</small><span>Open champion sheet</span></a><p v-if="champions.length">Sheets open separately so your current character stays in place.</p></section>
</template>

<style scoped>
.shadow-champions { margin-top:17px; border-top:1px solid var(--cb-line); padding-top:15px; text-align:left; }
.shadow-champions h3 { font:16px Georgia,serif; color:var(--cb-ink); line-height:1.4; margin:0 0 10px; }
.shadow-champions p { font-size:11px; line-height:1.6; color:var(--cb-muted); margin:8px 0; }
.shadow-champions a { display:flex; flex-direction:column; gap:5px; background:var(--cb-field); border:1px solid var(--cb-line); border-radius:6px; padding:11px 12px; text-decoration:none; margin-top:9px; }
.shadow-champions a:hover,.shadow-champions a:focus-visible { border-color:var(--cb-accent-mark); }
.shadow-champions strong { display:flex; justify-content:space-between; color:var(--cb-ink); font-size:15px; font-weight:500; }
.shadow-champions small { font-size:11px; color:var(--cb-muted); }
.shadow-champions a>span,.shadow-champions button { color:var(--cb-accent-text); font-size:11px; }
.shadow-champions button { border:0; background:none; text-decoration:underline; cursor:pointer; }
</style>
