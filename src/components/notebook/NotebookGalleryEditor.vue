<script setup lang="ts">
import {nextTick,onBeforeUnmount,ref} from 'vue'
import {NOTEBOOK_GALLERY_LIMIT,type NotebookArtwork} from '../../../shared/notebook-gallery'
import {prepareNotebookArtwork} from '../../lib/notebook-cover'
const images=defineModel<NotebookArtwork[]>({required:true})
const props=defineProps<{disabled?:boolean}>(),emit=defineEmits<{busy:[value:boolean]}>()
const busy=ref(false),error=ref(''),section=ref<HTMLElement|null>(null)
let disposed=false
defineExpose({focus(){const input=section.value?.querySelector<HTMLInputElement>('input');input?.scrollIntoView({block:'center',behavior:'instant'});input?.focus({preventScroll:true})}})
onBeforeUnmount(()=>{disposed=true;emit('busy',false)})
async function upload(event:Event){
 const input=event.target as HTMLInputElement,files=[...input.files??[]];input.value=''
 if(!files.length||props.disabled||busy.value)return
 error.value=''
 if(files.length+images.value.length>NOTEBOOK_GALLERY_LIMIT){error.value=`Keep up to ${NOTEBOOK_GALLERY_LIMIT} images. Choose fewer files or remove an image first.`;return}
 busy.value=true;emit('busy',true)
 try{
  const additions:NotebookArtwork[]=[]
  for(const file of files){const image=await prepareNotebookArtwork(file);if(disposed)return;additions.push({id:crypto.randomUUID(),image,title:'',caption:''})}
  if(!disposed)images.value=[...images.value,...additions]
 }catch(e){if(!disposed)error.value=e instanceof Error?e.message:'This image could not be prepared. Try another file.'}
 finally{if(!disposed){busy.value=false;emit('busy',false)}}
}
async function move(index:number,direction:number){const rows=[...images.value],other=index+direction;if(!rows[other])return;[rows[index],rows[other]]=[rows[other]!,rows[index]!];images.value=rows;await nextTick();section.value?.querySelector<HTMLElement>(`[data-artwork-id="${rows[other]!.id}"] button[data-direction="${direction}"]`)?.focus()}
</script>
<template><section ref="section" class="notebook-gallery-editor" aria-label="Place gallery" :aria-busy="busy">
 <h3>Gallery</h3><p class="sheet-small">Add artwork that shows players what this place looks like. Images follow this entry's sharing settings.</p>
 <label>Add images<input type="file" accept="image/jpeg,image/png,image/webp" multiple :disabled="disabled||busy||images.length>=NOTEBOOK_GALLERY_LIMIT" @change="upload" /></label>
 <p class="sheet-small">Up to {{NOTEBOOK_GALLERY_LIMIT}} images. JPG, PNG or WebP, up to 10 MB each; images are resized automatically.</p>
 <p v-if="busy" role="status" class="sheet-small">Preparing images…</p><p v-if="error" role="alert" class="sheet-alert">{{error}}</p>
 <article v-for="(art,index) in images" :key="art.id" :data-artwork-id="art.id" class="notebook-artwork-editor">
  <img :src="art.image" :alt="art.title||`Gallery image ${index+1} preview`" />
  <div><label>Image title<input v-model="art.title" maxlength="120" :disabled="disabled||busy" /></label><label>Caption<textarea v-model="art.caption" maxlength="1000" rows="2" :disabled="disabled||busy" placeholder="The view, season, or details players should notice" /></label>
   <div class="notebook-actions"><button type="button" class="sheet-button sheet-small-button" data-direction="-1" :aria-label="`Move image ${index+1} earlier`" :disabled="disabled||busy||index===0" @click="move(index,-1)">Move earlier</button><button type="button" class="sheet-button sheet-small-button" data-direction="1" :aria-label="`Move image ${index+1} later`" :disabled="disabled||busy||index===images.length-1" @click="move(index,1)">Move later</button><button type="button" class="sheet-button sheet-small-button" :aria-label="`Remove image ${index+1}`" :disabled="disabled||busy" @click="images=images.filter(row=>row.id!==art.id)">Remove</button></div>
  </div>
 </article>
 <p v-if="!images.length" class="sheet-small">No gallery images added. The header image will appear here until you add artwork.</p>
</section></template>
