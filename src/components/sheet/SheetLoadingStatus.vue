<script setup lang="ts">
import { computed } from 'vue'
import { useCharactersStore } from '../../stores/characters'
defineProps<{loading:boolean;referenceMs:number;source:'network'|'cache';warning:boolean}>()
defineEmits<{reload:[]}>()
const store=useCharactersStore()
const history=computed(()=>store.loadHistory.filter(row=>row.characterId===store.current?._id).slice(0,8))
const seconds=(ms:number)=>`${(ms/1000).toFixed(2)} s`
const time=(value:string)=>new Date(value).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})
</script>
<template>
  <details class="sheet-loading-status">
    <summary>Loading status</summary>
    <p>Saved sheet opened in {{seconds(store.lastOpenMs)}}.</p>
    <p v-if="loading">Rules and reference details are still refreshing.</p>
    <p v-else>Rules and reference check: {{seconds(referenceMs)}} · {{source==='cache'?'Unchanged references reused':'References fetched from server'}}.</p>
    <div v-if="history.length" class="sheet-table-wrap">
      <table class="sheet-table">
        <caption>Recent openings in this browser session. Sheet and reference times are separate; background polling is excluded.</caption>
        <thead><tr><th>Opened</th><th>Sheet</th><th>References</th><th>Reference source</th></tr></thead>
        <tbody><tr v-for="row in history" :key="row.at"><td>{{time(row.at)}}</td><td>{{seconds(row.sheetMs)}}</td><td>{{row.referenceMs===null?'Refreshing…':seconds(row.referenceMs)}}{{row.partial?' · incomplete':''}}</td><td>{{row.source==='cache'?'Reused':row.source==='network'?'Server':'Pending'}}</td></tr></tbody>
      </table>
    </div>
    <button v-if="warning" type="button" class="sheet-button sheet-small-button" :disabled="loading" @click="$emit('reload')">Retry reference details</button>
  </details>
</template>
