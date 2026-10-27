<script setup lang="ts">
import {computed,nextTick,ref,useId} from 'vue'
import {notebookTags,notebookTagKey,NOTEBOOK_TAG_LIMIT,NOTEBOOK_TAG_LENGTH} from '../../../shared/notebook-tags'
const tags=defineModel<string[]>({required:true})
const props=defineProps<{options:{name:string;count:number}[];disabled:boolean}>()
const query=ref(''),message=ref(''),input=ref<HTMLInputElement|null>(null),id=useId()
const chosen=(name:string)=>tags.value.some(tag=>notebookTagKey(tag)===notebookTagKey(name))
const existing=computed(()=>props.options.find(tag=>notebookTagKey(tag.name)===notebookTagKey(query.value)))
const matches=computed(()=>props.options.filter(tag=>notebookTagKey(tag.name).includes(notebookTagKey(query.value))).sort((a,b)=>b.count-a.count||a.name.localeCompare(b.name,'hu')))
const canAdd=computed(()=>!!query.value.trim()&&!chosen(query.value)&&tags.value.length<NOTEBOOK_TAG_LIMIT)
async function focus(){await nextTick();input.value?.focus({preventScroll:true})}
defineExpose({focus})
function toggle(name:string){
  if(props.disabled)return
  message.value=''
  if(chosen(name))tags.value=tags.value.filter(tag=>notebookTagKey(tag)!==notebookTagKey(name))
  else if(tags.value.length<NOTEBOOK_TAG_LIMIT)tags.value=[...tags.value,name]
}
async function add(){
  if(props.disabled||!canAdd.value)return
  const value=existing.value?.name??notebookTags([query.value])[0]
  if(!value)return
  if(/[\p{Cc}\p{Cf}]/u.test(value)){message.value='Use a tag without control characters.';return}
  tags.value=[...tags.value,value];query.value='';message.value='';await focus()
}
function enter(event:KeyboardEvent){if(event.isComposing)return;event.preventDefault();void add()}
</script>
<template>
  <section class="codex-tags-editor notebook-tag-editor" aria-label="Entry tag choices">
    <div class="tag-selected" aria-label="Selected entry tags"><button v-for="tag in tags" :key="tag" type="button" class="sheet-button sheet-small-button" :disabled="disabled" :aria-label="'Remove tag '+tag" @click="toggle(tag)">{{tag}} <span aria-hidden="true">×</span></button><span v-if="!tags.length" class="sheet-small">No tags assigned.</span></div>
    <label :for="id">Find or create a tag</label>
    <div class="codex-tag-input"><input :id="id" ref="input" v-model="query" type="search" :maxlength="NOTEBOOK_TAG_LENGTH" :disabled="disabled" placeholder="Search tags or type a new one" @keydown.enter="enter" /><button type="button" class="sheet-button sheet-small-button" :disabled="disabled||!canAdd" @click="add">{{existing?'Add tag':'Create & add'}}</button></div>
    <div class="tag-choice-list" role="group" aria-label="Available tags"><button v-for="tag in matches.slice(0,12)" :key="tag.name" type="button" class="sheet-button sheet-small-button" :aria-pressed="chosen(tag.name)" :disabled="disabled||(!chosen(tag.name)&&tags.length>=NOTEBOOK_TAG_LIMIT)" @click="toggle(tag.name)"><span aria-hidden="true">{{chosen(tag.name)?'✓':'+'}}</span> {{tag.name}}</button></div>
    <p v-if="message" class="sheet-small" role="alert">{{message}}</p>
    <p v-else-if="tags.length>=NOTEBOOK_TAG_LIMIT" class="sheet-small" role="status">Choose up to {{NOTEBOOK_TAG_LIMIT}} tags. Remove one to add another.</p>
    <p v-else class="sheet-small">{{matches.length>12?'Showing 12 of '+matches.length+' tags. Search to find another.':!matches.length&&query?'No matching tags. Use Create & add to assign this new tag.':'Click tags to add or remove them. Tags do not change who can read this entry.'}}</p>
  </section>
</template>
<style scoped>
.notebook-tag-editor{gap:8px}.notebook-tag-editor>label{font-size:12px}.notebook-tag-editor p{margin:0;line-height:1.6}.tag-selected,.tag-choice-list{display:flex;gap:6px;flex-wrap:wrap;min-width:0}.tag-selected>.sheet-button,.tag-choice-list>.sheet-button{white-space:normal;overflow-wrap:anywhere;max-width:100%;min-height:36px;text-align:left}.tag-selected>.sheet-button{background:var(--cb-accent-soft)}.tag-choice-list [aria-pressed=true]{border-color:var(--cb-accent-text);background:var(--cb-accent-soft)}.notebook-tag-editor :is(input,button):focus-visible{outline:2px solid var(--cb-accent-text);outline-offset:2px}
@container campaign-notebook (max-width:620px){.tag-selected>.sheet-button,.tag-choice-list>.sheet-button,.codex-tag-input>.sheet-button{min-height:44px}.codex-tag-input{flex-wrap:wrap}.codex-tag-input>input{flex-basis:180px}}
</style>
