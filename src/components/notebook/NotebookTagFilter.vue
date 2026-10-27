<script setup lang="ts">
import {computed,ref} from 'vue'
import {notebookTagKey,notebookTags,NOTEBOOK_TAG_LENGTH,NOTEBOOK_TAG_LIMIT} from '../../../shared/notebook-tags'
const props=defineProps<{modelValue:string[];options:{name:string;count:number}[];disabled:boolean;canCreate:boolean;saving:boolean;create:(name:string)=>Promise<boolean>}>()
const emit=defineEmits<{'update:modelValue':[tags:string[]]}>()
const search=ref(''),name=ref(''),createOpen=ref(false)
const options=computed(()=>{
  const values=[...props.options]
  for(const name of props.modelValue)if(!values.some(t=>notebookTagKey(t.name)===notebookTagKey(name)))values.push({name,count:0})
  return values.filter(t=>notebookTagKey(t.name).includes(notebookTagKey(search.value)))
})
const chosen=(name:string)=>props.modelValue.some(t=>notebookTagKey(t)===notebookTagKey(name))
const exists=computed(()=>props.options.some(t=>notebookTagKey(t.name)===notebookTagKey(name.value)))
function toggle(name:string){if(props.disabled)return;emit('update:modelValue',chosen(name)?props.modelValue.filter(t=>notebookTagKey(t)!==notebookTagKey(name)):[...props.modelValue,name])}
function change(name:string,event:Event){(event.target as HTMLInputElement).checked=chosen(name);toggle(name)}
async function add(){const value=notebookTags([name.value])[0];if(!value||props.disabled||exists.value)return;if(await props.create(value)){name.value='';createOpen.value=false}}
</script>
<template>
  <section class="codex-tag-filter notebook-library-tags" aria-label="Filter by tags">
    <div class="tag-filter-heading"><h3>Filter by tags</h3><button v-if="modelValue.length" type="button" class="notebook-inline-link" :disabled="disabled" @click="emit('update:modelValue',[])">Clear</button></div>
    <div v-if="modelValue.length" class="tag-filter-selected" aria-label="Active tag filters"><button v-for="tag in modelValue" :key="tag" type="button" class="sheet-button sheet-small-button" :disabled="disabled" :aria-label="'Remove tag filter '+tag" @click="toggle(tag)">{{tag}} <span aria-hidden="true">×</span></button></div>
    <label>Find a tag<input v-model="search" type="search" :maxlength="NOTEBOOK_TAG_LENGTH" :disabled="disabled" placeholder="Search tags" /></label>
    <div class="codex-tag-options" role="group" aria-label="Tag filters"><label v-for="tag in options" :key="tag.name" class="notebook-check"><input type="checkbox" :checked="chosen(tag.name)" :disabled="disabled||(!chosen(tag.name)&&modelValue.length>=NOTEBOOK_TAG_LIMIT)" @change="change(tag.name,$event)" /><span>{{tag.name}}</span><small :aria-label="tag.count+' entries'">{{tag.count}}</small></label></div>
    <p v-if="!options.length" class="sheet-small">{{search?'No matching tags.':'No tags yet. Open an entry and choose Add tags.'}}</p>
    <p v-if="modelValue.length" class="sheet-small">{{modelValue.length>1?'Matches every selected tag in this list.':'Showing entries with this tag.'}}</p>
    <details v-if="canCreate" :open="createOpen" class="tag-filter-create" @toggle="createOpen=($event.target as HTMLDetailsElement).open"><summary>Create a tag</summary><form @submit.prevent="add"><label>New tag<input v-model="name" :maxlength="NOTEBOOK_TAG_LENGTH" :disabled="disabled" required placeholder="Tag name" /></label><button class="sheet-button sheet-small-button" :disabled="disabled||!name.trim()||exists">{{saving?'Creating…':'Create tag'}}</button><p class="sheet-small">{{exists?'This tag already exists.':'Creates a tag to assign later. To tag an entry now, use its Add tags button.'}}</p></form></details>
  </section>
</template>
<style scoped>
.notebook-library-tags{margin:0;padding:0 0 12px;border-top:0;font-size:12px}.tag-filter-heading{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:0 0 8px}.tag-filter-heading h3{margin:0!important;font-size:14px!important}.tag-filter-heading>.notebook-inline-link{font-size:12px;min-height:32px}.tag-filter-selected{display:flex;flex-wrap:wrap;gap:5px;margin:0 0 10px}.tag-filter-selected>.sheet-button{font-size:11px;white-space:normal;overflow-wrap:anywhere;max-width:100%;background:var(--cb-accent-soft);text-align:left;min-height:32px}.notebook-library-tags .codex-tag-options{max-height:156px;margin-top:5px}.notebook-library-tags .notebook-check{margin:0;padding:5px 1px;min-height:32px;box-sizing:border-box;cursor:pointer}.notebook-library-tags p{margin:7px 0 0;line-height:1.5}.tag-filter-create{margin-top:9px;color:var(--cb-muted)}.tag-filter-create summary{cursor:pointer;min-height:28px}.tag-filter-create form{display:grid;gap:8px;padding-top:6px}.tag-filter-create button{justify-self:start}.notebook-library-tags :is(button,input,summary):focus-visible{outline:2px solid var(--cb-accent-text);outline-offset:2px}
@container campaign-notebook (max-width:620px){.notebook-library-tags .notebook-check,.tag-filter-selected>.sheet-button{min-height:44px}}
</style>
