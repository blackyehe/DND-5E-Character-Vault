<script setup lang="ts">
import {computed,onBeforeUnmount,ref,watch} from 'vue'
import type {NotebookArtwork} from '../../../shared/notebook-gallery'
const props=defineProps<{images:NotebookArtwork[];cover?:string;place:string;entryId:string;editable?:boolean}>()
const emit=defineEmits<{edit:[]}>()
const artwork=computed(()=>props.images.length?props.images:props.cover?[{id:'header',image:props.cover,title:props.place,caption:''}]:[])
const dialog=ref<HTMLDialogElement|null>(null),active=ref(0),failed=ref<string[]>([]),opener=ref<HTMLButtonElement|null>(null)
const current=computed(()=>artwork.value[active.value])
function open(index:number,event:Event){active.value=index;opener.value=event.currentTarget as HTMLButtonElement;dialog.value?.showModal()}
function close(){dialog.value?.close()}
function closed(){opener.value?.focus({preventScroll:true})}
function move(delta:number){active.value=(active.value+delta+artwork.value.length)%artwork.value.length}
watch(()=>[props.entryId,props.images,props.cover],()=>{close();failed.value=[]})
onBeforeUnmount(close)
</script>
<template><section class="notebook-gallery" aria-label="Place artwork">
 <div v-if="artwork.length" class="notebook-gallery-images"><figure v-for="(art,index) in artwork" :key="art.id">
  <button type="button" class="notebook-artwork-open" :aria-label="`Enlarge ${art.title||place+' image '+(index+1)}`" @click="open(index,$event)">
   <span v-if="failed.includes(art.id)" class="notebook-artwork-unavailable">Image unavailable</span><img v-else :src="art.image" :alt="art.title||`${place}, view ${index+1}`" loading="lazy" decoding="async" @error="failed.push(art.id)" />
   <span class="notebook-artwork-enlarge">Enlarge image</span>
  </button><figcaption v-if="art.title||art.caption"><h3 v-if="art.title">{{art.title}}</h3><p v-if="art.caption">{{art.caption}}</p></figcaption>
 </figure></div>
 <div v-else class="notebook-gallery-empty"><h3>A glimpse of {{place}}</h3><p>{{editable?'Add artwork of this place for its readers to explore.':'No artwork has been added for this place yet.'}}</p><button v-if="editable" type="button" class="sheet-button" @click="emit('edit')">Add artwork</button></div>
 <dialog ref="dialog" class="notebook-artwork-dialog" :aria-label="current?.title||place+' artwork'" @close="closed" @click="($event.target===$event.currentTarget)&&close()" @keydown.left.prevent="artwork.length>1&&move(-1)" @keydown.right.prevent="artwork.length>1&&move(1)">
  <div v-if="current" class="notebook-artwork-viewer"><header><span>{{active+1}} / {{artwork.length}}</span><button type="button" autofocus class="sheet-button" aria-label="Close artwork" @click="close">Close</button></header><img :src="current.image" :alt="current.title||place" /><footer><div><h3>{{current.title||place}}</h3><p v-if="current.caption">{{current.caption}}</p></div><div v-if="artwork.length>1" class="notebook-actions"><button type="button" class="sheet-button" aria-label="Previous artwork" @click="move(-1)">Previous</button><button type="button" class="sheet-button" aria-label="Next artwork" @click="move(1)">Next</button></div></footer></div>
 </dialog>
</section></template>
