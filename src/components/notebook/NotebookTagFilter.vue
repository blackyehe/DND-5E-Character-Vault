<script setup lang="ts">
import {computed,nextTick,onMounted,onUnmounted,ref} from 'vue'
import {notebookTagKey,notebookTags,NOTEBOOK_TAG_LENGTH,NOTEBOOK_TAG_LIMIT} from '../../../shared/notebook-tags'
const props=defineProps<{modelValue:string[];options:{name:string;count:number}[];disabled:boolean;canCreate:boolean;saving:boolean;create:(name:string)=>Promise<boolean>}>()
const emit=defineEmits<{'update:modelValue':[tags:string[]]}>()
const search=ref(''),name=ref(''),createOpen=ref(false)
const root=ref<HTMLDetailsElement|null>(null),searchInput=ref<HTMLInputElement|null>(null)
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
function close(focus=false){if(root.value)root.value.open=false;if(focus)root.value?.querySelector('summary')?.focus({preventScroll:true})}
function outside(event:PointerEvent){if(event.target instanceof Node&&!root.value?.contains(event.target))close()}
async function opened(){if(root.value?.open){await nextTick();searchInput.value?.focus({preventScroll:true})}}
onMounted(()=>document.addEventListener('pointerdown',outside))
onUnmounted(()=>document.removeEventListener('pointerdown',outside))
</script>
<template>
  <details ref="root" class="codex-tag-filter notebook-library-tags" @toggle="opened" @keydown.esc.stop.prevent="close(true)">
    <summary :aria-disabled="disabled" @click="disabled&&$event.preventDefault()"><span>Filter by tags</span><small>{{modelValue.length?modelValue.length+' selected':'All tags'}}</small><span class="tag-filter-chevron" aria-hidden="true">⌄</span></summary>
    <section class="tag-filter-dropdown" aria-label="Filter by tags">
    <div class="tag-filter-heading"><h3>Choose tags</h3><button v-if="modelValue.length" type="button" class="notebook-inline-link" :disabled="disabled" @click="emit('update:modelValue',[])">Clear</button><button type="button" class="notebook-inline-link" @click="close(true)">Done</button></div>
    <div v-if="modelValue.length" class="tag-filter-selected" aria-label="Active tag filters"><button v-for="tag in modelValue" :key="tag" type="button" class="sheet-button sheet-small-button" :disabled="disabled" :aria-label="'Remove tag filter '+tag" @click="toggle(tag)">{{tag}} <span aria-hidden="true">×</span></button></div>
    <label>Find a tag<input ref="searchInput" v-model="search" type="search" :maxlength="NOTEBOOK_TAG_LENGTH" :disabled="disabled" placeholder="Search tags" /></label>
    <div class="codex-tag-options" role="group" aria-label="Tag filters"><label v-for="tag in options" :key="tag.name" class="notebook-check"><input type="checkbox" :checked="chosen(tag.name)" :disabled="disabled||(!chosen(tag.name)&&modelValue.length>=NOTEBOOK_TAG_LIMIT)" @change="change(tag.name,$event)" /><span>{{tag.name}}</span><small :aria-label="tag.count+' entries'">{{tag.count}}</small></label></div>
    <p v-if="!options.length" class="sheet-small">{{search?'No matching tags.':'No tags yet. Open an entry and choose Add tags.'}}</p>
    <p v-if="modelValue.length" class="sheet-small">{{modelValue.length>1?'Matches every selected tag in this list.':'Showing entries with this tag.'}}</p>
    <details v-if="canCreate" :open="createOpen" class="tag-filter-create" @toggle="createOpen=($event.target as HTMLDetailsElement).open"><summary>Create a tag</summary><form @submit.prevent="add"><label>New tag<input v-model="name" :maxlength="NOTEBOOK_TAG_LENGTH" :disabled="disabled" required placeholder="Tag name" /></label><button class="sheet-button sheet-small-button" :disabled="disabled||!name.trim()||exists">{{saving?'Creating…':'Create tag'}}</button><p class="sheet-small">{{exists?'This tag already exists.':'Creates a tag to assign later. To tag an entry now, use its Add tags button.'}}</p></form></details>
    </section>
  </details>
</template>
<style scoped>
/* The shared disclosure animation clips normal in-flow content. This menu
   floats over the list, so retain its fade while allowing the popup to escape. */
.notebook-library-tags[open]{z-index:5}
.notebook-library-tags::details-content{overflow:visible!important;block-size:auto!important}
.notebook-library-tags{position:relative;margin:0 0 12px;padding:0;border:0;font-size:12px;flex-shrink:0}.notebook-library-tags>summary{display:flex;align-items:center;gap:8px;list-style:none;min-height:40px;box-sizing:border-box;padding:8px 10px;border:1px solid var(--cb-line);border-radius:4px;background:var(--cb-field);color:var(--cb-ink)}.notebook-library-tags>summary::-webkit-details-marker{display:none}.notebook-library-tags>summary>small{margin-left:auto;float:none;color:var(--cb-accent-text)}.notebook-library-tags>summary[aria-disabled=true]{opacity:.6;cursor:default}.tag-filter-chevron{transition:transform 160ms ease}.notebook-library-tags[open] .tag-filter-chevron{transform:rotate(180deg)}.tag-filter-dropdown{position:absolute;inset-inline:0;top:calc(100% + 5px);z-index:10;box-sizing:border-box;max-height:min(420px,44dvh);overflow:auto;overscroll-behavior:contain;scrollbar-gutter:stable;padding:12px;background:var(--cb-paper);border:1px solid var(--cb-line);border-radius:4px;box-shadow:0 8px 22px #0003}.tag-filter-heading{display:flex;align-items:center;gap:8px;margin:0 0 8px}.tag-filter-heading h3{flex:1;margin:0!important;font-size:14px!important}.tag-filter-heading>.notebook-inline-link{font-size:12px;min-height:32px}.tag-filter-selected{display:flex;flex-wrap:wrap;gap:5px;margin:0 0 10px;max-height:88px;overflow:auto}.tag-filter-selected>.sheet-button{font-size:11px;white-space:normal;overflow-wrap:anywhere;max-width:100%;background:var(--cb-accent-soft);text-align:left;min-height:32px}.notebook-library-tags .codex-tag-options{max-height:200px;margin-top:5px}.notebook-library-tags .notebook-check{margin:0;padding:5px 1px;min-height:32px;box-sizing:border-box;cursor:pointer}.notebook-library-tags p{margin:7px 0 0;line-height:1.5}.tag-filter-create{margin-top:9px;color:var(--cb-muted)}.tag-filter-create summary{cursor:pointer;min-height:28px}.tag-filter-create form{display:grid;gap:8px;padding-top:6px}.tag-filter-create button{justify-self:start}.notebook-library-tags :is(button,input,summary):focus-visible{outline:2px solid var(--cb-accent-text);outline-offset:2px}
@media(prefers-reduced-motion:reduce){.tag-filter-chevron{transition:none}}
@container campaign-notebook (max-width:620px){.notebook-library-tags .notebook-check,.tag-filter-selected>.sheet-button{min-height:44px}}
</style>
