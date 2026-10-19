<script setup lang="ts">
import { computed } from 'vue'
import { useCharactersStore } from '../../stores/characters'
const emit=defineEmits<{edit:[]}>(),store=useCharactersStore()
const state=computed(()=>store.current?.homebrew)
async function acknowledge(){if(!state.value||!store.current||store.saving)return;try{await store.update(store.current._id,{homebrew:{...state.value,acknowledged:[...new Set([...state.value.acknowledged,...state.value.conflicts.map(c=>c.id)])],conflicts:[]}})}catch{/* The sheet displays the save error. */}}
</script>
<template><details v-if="state?.conflicts.length" class="sheet-panel" style="margin-bottom:16px" role="status"><summary style="cursor:pointer">Rule changes need review · {{state.conflicts.length}} differences</summary><p class="sheet-small">Your play state and custom choices have been kept. Review these differences before continuing.</p><ul style="margin:12px 0;padding-left:20px;font-size:13px;line-height:1.7"><li v-for="conflict in state.conflicts" :key="conflict.id" style="list-style:disc">{{conflict.message}}</li></ul><div class="sheet-filter-buttons"><button class="sheet-button sheet-button-primary" @click="emit('edit')">Review in Edit character</button><button class="sheet-button" :disabled="store.saving" @click="acknowledge">I’ve reviewed these differences</button></div></details></template>
