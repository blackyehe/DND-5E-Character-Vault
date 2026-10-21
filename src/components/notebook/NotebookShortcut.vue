<script setup lang="ts">
import {ref} from 'vue'
import {useRouter} from 'vue-router'
import {api} from '../../lib/api'
import type {RoomSummary} from '../../../shared/rooms'
const props=defineProps<{characterId:string;disabled?:boolean}>()
const router=useRouter(),open=ref(false),loading=ref(false),rooms=ref<RoomSummary[]>([]),error=ref('')
async function show(){if(props.disabled)return;open.value=!open.value;if(!open.value)return;loading.value=true;error.value='';try{rooms.value=await api.get<RoomSummary[]>('/api/rooms')}catch(e){error.value=e instanceof Error?e.message:'Could not load your rooms.'}finally{loading.value=false}}
function go(room:RoomSummary){void router.push({path:`/rooms/${room.id}`,query:{section:'notebook',...(room.role==='dm'?{character:props.characterId}:{})}})}
</script>
<template><div class="notebook-shortcut"><button type="button" class="sheet-button sheet-small-button" :disabled="disabled" :aria-expanded="open" @click="show">Open notebook</button><section v-if="open" class="sheet-panel notebook-room-picker" aria-label="Choose a campaign notebook"><h3>Choose a game room</h3><p v-if="loading" class="sheet-small" role="status">Opening your rooms…</p><p v-if="error" class="sheet-alert">{{error}}</p><div class="sheet-filter-buttons"><button v-for="room in rooms" :key="room.id" type="button" class="sheet-button" :disabled="disabled" @click="go(room)">{{room.name}}</button><RouterLink v-if="!loading&&!rooms.length&&!error" to="/rooms">Create or join a game room</RouterLink><button type="button" class="sheet-button" @click="open=false">Close</button></div></section></div></template>
<style scoped>.notebook-shortcut{position:relative}.notebook-room-picker{position:absolute;right:0;top:calc(100% + 7px);width:min(380px,80vw);max-height:300px;overflow:auto;z-index:20;box-shadow:0 8px 24px #0003}.notebook-room-picker h3{margin:0 0 12px}.notebook-room-picker .sheet-filter-buttons{display:flex;gap:8px;flex-wrap:wrap}.notebook-room-picker .sheet-button{max-width:100%;white-space:normal;overflow-wrap:anywhere}</style>
