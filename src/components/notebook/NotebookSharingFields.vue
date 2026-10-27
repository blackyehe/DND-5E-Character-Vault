<script setup lang="ts">
import {computed,ref} from 'vue'
import type {NotebookAudience} from '../../../shared/notebook'
const value=defineModel<{audience:NotebookAudience;characterIds:string[]}>({required:true})
const props=defineProps<{characters:{id:string;name:string;assigned:boolean}[];quest:boolean;disabled:boolean;folderNotice:string}>()
const input=ref<HTMLSelectElement|null>(null)
const unavailable=computed(()=>value.value.characterIds.filter(id=>!props.characters.some(c=>c.id===id&&c.assigned)))
function audience(event:Event){value.value={audience:(event.target as HTMLSelectElement).value as NotebookAudience,characterIds:[]}}
defineExpose({focus:()=>input.value?.focus({preventScroll:true})})
</script>
<template>
  <div class="notebook-sharing-fields">
    <label>Who can see this entry?<select ref="input" :value="value.audience" :disabled="disabled" @change="audience"><option value="dm">DM only</option><option value="room">Whole room</option><option v-if="!quest" value="characters">Selected characters</option></select></label>
    <fieldset v-if="value.audience==='characters'"><legend>Players assigned to</legend><div class="notebook-sharing-characters"><label v-for="character in characters.filter(c=>c.assigned)" :key="character.id" class="notebook-check"><input v-model="value.characterIds" type="checkbox" :value="character.id" :disabled="disabled" />{{character.name}}</label></div><p v-if="!characters.some(c=>c.assigned)" class="sheet-small">No characters are assigned to room members yet.</p><p v-else-if="!value.characterIds.length" class="sheet-small">Choose at least one character.</p><div v-if="unavailable.length" class="notebook-sharing-unavailable"><p class="sheet-small">These characters are no longer assigned. Remove them before saving.</p><button v-for="id in unavailable" :key="id" type="button" class="sheet-button sheet-small-button" :disabled="disabled" @click="value.characterIds=value.characterIds.filter(c=>c!==id)">Remove {{characters.find(c=>c.id===id)?.name??'unavailable character'}}</button></div></fieldset>
    <p class="sheet-small">{{value.audience==='dm'?'Only the DM can read this entry.':value.audience==='room'?'Room members can read this entry.':'Only the DM and players assigned to these characters can read this entry.'}}{{quest?' Private clues keep their own visibility.':''}}</p>
    <p v-if="folderNotice" class="sheet-notice">{{folderNotice}}</p>
  </div>
</template>
