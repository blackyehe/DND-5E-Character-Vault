<script setup lang="ts">
import {onBeforeUnmount,onMounted,ref,watch} from 'vue'
const props=defineProps<{open:boolean}>()
const emit=defineEmits<{close:[]}>()
const dialog=ref<HTMLDialogElement|null>(null),body=ref<HTMLElement|null>(null)
defineExpose({body})
let locked=false,overflow='',rootOverflow='',gutter='',scroll={left:0,top:0}
function unlock(){if(!locked)return;locked=false;document.body.style.overflow=overflow;document.documentElement.style.overflow=rootOverflow;document.documentElement.style.scrollbarGutter=gutter;window.scrollTo({...scroll,behavior:'instant'})}
function sync(){
 if(props.open&&!dialog.value?.open&&dialog.value){
  scroll={left:window.scrollX,top:window.scrollY};overflow=document.body.style.overflow;rootOverflow=document.documentElement.style.overflow;gutter=document.documentElement.style.scrollbarGutter
  locked=true;document.body.style.overflow='hidden';document.documentElement.style.overflow='hidden';document.documentElement.style.scrollbarGutter='auto';dialog.value.showModal()
 }else if(!props.open){dialog.value?.close();unlock()}
}
function closed(){unlock();if(props.open)emit('close')}
function keepFocus(event:KeyboardEvent){
 if(event.key!=='Tab'||!dialog.value)return
 const nodes=[...dialog.value.querySelectorAll<HTMLElement>('button,a[href],input,select,textarea,summary,[tabindex]')].filter(el=>el.tabIndex>=0&&!el.matches(':disabled')&&el.getClientRects().length>0),first=nodes[0],last=nodes.at(-1)
 if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus()}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus()}
}
watch(()=>props.open,sync,{flush:'post'});onMounted(sync)
onBeforeUnmount(()=>{dialog.value?.close();unlock()})
</script>
<template>
 <dialog ref="dialog" class="compendium-focus" aria-label="Focused Compendium reader" @cancel.prevent="emit('close')" @close="closed" @keydown="keepFocus" @click="$event.target===$event.currentTarget&&emit('close')">
  <div class="compendium-focus-frame"><header class="compendium-focus-header"><h2>Compendium</h2><button type="button" class="btn-ghost" autofocus aria-label="Close focus view" @click="emit('close')">Close focus view <span aria-hidden="true">×</span></button></header><div ref="body" class="compendium-focus-body" /></div>
 </dialog>
</template>
<style>
.compendium-focus{width:min(1180px,calc(100vw - 40px));height:calc(100dvh - 40px);max-width:none;max-height:none;margin:auto;padding:0;border:1px solid var(--cb-line);border-radius:12px;background:var(--cb-paper);color:var(--cb-ink);overflow:hidden}
.compendium-focus::backdrop{background:#080709e8}
.compendium-focus-frame{height:100%;min-height:0;display:flex;flex-direction:column}
.compendium-focus-header{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-shrink:0;padding:16px 24px;border-bottom:1px solid var(--cb-line);background:var(--cb-soft)}
.compendium-focus-header h2{font:500 22px/1.3 var(--sheet-title-font,var(--font-display));margin:0}
.compendium-focus-body{flex:1;min-height:0;display:flex;overflow:hidden}
.compendium-focus-body>.compendium-detail{flex:1;min-width:0;min-height:0;height:auto;margin:0;overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable;border:0;border-radius:0;padding:28px clamp(20px,5vw,60px)}
.compendium-focus-body .compendium-detail-content{max-width:88ch;margin-inline:auto}
.compendium-focus-header button{min-height:42px;flex:none}
@media(max-width:650px){.compendium-focus{width:100vw;height:100dvh;border-radius:0;border:0}.compendium-focus-header{padding:12px 16px;gap:8px}.compendium-focus-header h2{font-size:20px}.compendium-focus-header button{font-size:13px}}
</style>
