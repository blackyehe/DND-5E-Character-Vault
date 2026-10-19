<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref } from 'vue'
import FeatureText from './FeatureText.vue'
const props=defineProps<{name:string;text:string}>()
const trigger=ref<HTMLButtonElement|null>(null),dialog=ref<HTMLDialogElement|null>(null)
const hovered=ref(false),suppressed=ref(false),showing=ref(false)
const left=ref(12),top=ref(12),above=ref(false),id=`rule-${crypto.randomUUID()}`
function preview(event:MouseEvent|FocusEvent){
  if(showing.value||suppressed.value)return
  const rect=(event.currentTarget as HTMLElement).getBoundingClientRect(),width=Math.min(380,window.innerWidth-24)
  left.value=Math.max(12,Math.min(rect.left,window.innerWidth-width-12));above.value=rect.top>270;top.value=above.value?rect.top-8:rect.bottom+8;hovered.value=true
}
function leave(){hovered.value=false;suppressed.value=false}
function hide(){hovered.value=false}
async function open(){hovered.value=false;suppressed.value=true;showing.value=true;await nextTick();dialog.value?.showModal()}
function closed(){showing.value=false;hovered.value=false;suppressed.value=true;trigger.value?.focus({preventScroll:true})}
onMounted(()=>{window.addEventListener('scroll',hide,true);window.addEventListener('resize',hide)})
onUnmounted(()=>{window.removeEventListener('scroll',hide,true);window.removeEventListener('resize',hide)})
</script>
<template>
  <span class="sheet-rule-reference" @mouseenter="preview" @mouseleave="leave" @focusin="preview" @focusout="leave" @keydown.esc="hide"><button ref="trigger" type="button" :aria-describedby="hovered?id:undefined" aria-haspopup="dialog" @click="open">{{props.name}} <span aria-hidden="true">ⓘ</span></button></span>
  <Teleport to=".site-shell"><div v-if="hovered&&!showing" :id="id" role="tooltip" class="sheet-rule-tooltip" :style="{left:`${left}px`,top:`${top}px`,transform:above?'translateY(-100%)':undefined}"><strong>{{name}}</strong><p>{{text.slice(0,500)}}{{text.length>500?'…':''}}</p><small>Click or tap for full rules</small></div><dialog v-if="showing" ref="dialog" class="sheet-feat-dialog" :aria-label="`${name} rules`" @close="closed"><header><h2>{{name}}</h2><button type="button" class="sheet-button" aria-label="Close resource rules" @click="dialog?.close()">✕</button></header><div class="sheet-feat-dialog-body"><FeatureText :text="text" /></div><footer><button type="button" class="sheet-button" @click="dialog?.close()">Close</button></footer></dialog></Teleport>
</template>
<style>
.sheet-rule-reference>button{font:inherit;color:inherit;cursor:pointer;text-align:inherit;background:none;border:0;padding:0;line-height:inherit}.sheet-rule-reference>button:hover{color:var(--cb-accent-text)}.sheet-rule-reference>button>span{font-size:11px;color:var(--cb-accent-text)}.sheet-rule-tooltip{position:fixed;z-index:90;pointer-events:none;width:min(380px,calc(100vw - 24px));padding:13px 15px;background:var(--cb-paper);color:var(--cb-ink);border:1px solid var(--cb-accent-mark);border-radius:7px;box-shadow:0 8px 28px #0008;font-size:13px;line-height:1.65}.sheet-rule-tooltip p{margin:7px 0;white-space:pre-line}.sheet-rule-tooltip small{color:var(--cb-accent-text);font-size:11px}.sheet-weapon-details>summary{cursor:pointer;color:var(--cb-accent-text)}
</style>
