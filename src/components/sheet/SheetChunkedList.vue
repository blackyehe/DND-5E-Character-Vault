<script setup lang="ts" generic="T">
import { computed, onMounted, onUnmounted, ref } from 'vue'
const props=withDefaults(defineProps<{items:T[];perColumn?:number}>(),{perColumn:6})
defineSlots<{default(props:{item:T;index:number}):unknown}>()
const container=ref<HTMLElement|null>(null),capacity=ref(1)
let observer:ResizeObserver|undefined
onMounted(()=>{
  observer=new ResizeObserver(entries=>{const width=entries[0]?.contentRect.width??0;if(width>0)capacity.value=Math.max(1,Math.min(3,Math.floor((width+14)/294)))})
  if(container.value)observer.observe(container.value)
})
onUnmounted(()=>observer?.disconnect())
const bands=computed(()=>{
  if(capacity.value===1)return [{start:0,columns:[{start:0,items:props.items}]}]
  const size=Math.max(1,props.perColumn),columns=[]
  for(let start=0;start<props.items.length;start+=size)columns.push({start,items:props.items.slice(start,start+size)})
  const result=[]
  for(let start=0;start<columns.length;start+=capacity.value)result.push({start,columns:columns.slice(start,start+capacity.value)})
  return result
})
</script>
<template>
  <div ref="container" class="sheet-chunked-list">
    <div v-for="band in bands" :key="band.start" class="sheet-list-band" :style="{'--sheet-list-columns':band.columns.length}">
      <div v-for="column in band.columns" :key="column.start" class="sheet-list-column">
        <slot v-for="(item,index) in column.items" :item="item" :index="column.start+index" />
      </div>
    </div>
  </div>
</template>
