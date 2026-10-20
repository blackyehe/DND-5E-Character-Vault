<script setup lang="ts">
import { ref, watch } from 'vue'
const props=withDefaults(defineProps<{title:string;count:number;groupKey:string;forceOpen?:boolean;plain?:boolean}>(),{forceOpen:false,plain:false})
const prefix='codex:sheet-group:v1:'
function read(){try{return localStorage.getItem(prefix+props.groupKey)!=='closed'}catch{return true}}
const expanded=ref(read())
watch(()=>props.groupKey,()=>{expanded.value=read()})
function toggle(event:Event){if(props.forceOpen)return;expanded.value=(event.target as HTMLDetailsElement).open;try{localStorage.setItem(prefix+props.groupKey,expanded.value?'open':'closed')}catch{/* Keep disclosures usable without device storage. */}}
</script>
<template>
  <details class="sheet-list-group" :class="{'sheet-panel':!plain}" :open="forceOpen||expanded" @toggle="toggle">
    <summary><span class="sheet-list-group-title">{{title}}</span><span class="sheet-count">{{count}}</span></summary>
    <div class="sheet-list-group-body"><slot /></div>
  </details>
</template>
