<script setup lang="ts">
import ChoiceGroupPicker from './ChoiceGroupPicker.vue'
import {choiceGroupProblem,choiceSelectionProblem,choiceDescription,type ChoiceGroup} from '../../../shared/choice-groups'
import {sameOptionIdentity} from '../../../shared/option-reference'
import type {CompendiumDefinition} from '../../../shared/compendium-editing'
import {computed,onBeforeUnmount,ref,watch} from 'vue'
import type {CharacterFeature} from '../../../shared/character'
import {MANUAL_OPTION_KINDS,optionTitle,type ManualOptionKind} from '../../../shared/option-kinds'
import {optionHasId} from '../../../shared/option-reference'
import {entryBenefits,benefitSummary} from '../../../shared/rule-benefits'
import type {HomebrewReference} from '../../lib/srd'
import {api} from '../../lib/api'
import {useAuthStore} from '../../stores/auth'
const props=defineProps<{level:number;selected:CharacterFeature[];reviewed?:CompendiumDefinition[]}>()
const emit=defineEmits<{add:[CharacterFeature]}>()
type Entry=HomebrewReference&{kind:ManualOptionKind;prerequisites?:unknown;optionBuilder?:{prerequisites?:string;choiceGroup?:ChoiceGroup}}
const auth=useAuthStore(),entries=ref<Entry[]>([]),kind=ref<ManualOptionKind>('invocations'),query=ref(''),loading=ref(false),loaded=ref(false),error=ref(''),chosen=ref<Entry|null>(null),confirmed=ref(false),acquired=ref(props.level)
const choiceIds=ref<string[]>([]),rawGroup=computed(()=>chosen.value?.optionBuilder?.choiceGroup),group=computed(()=>rawGroup.value&&!choiceGroupProblem(rawGroup.value)?rawGroup.value:undefined),choiceProblem=computed(()=>rawGroup.value?choiceGroupProblem(rawGroup.value)??choiceSelectionProblem(rawGroup.value,choiceIds.value):undefined)
const existing=(entry:Entry)=>props.selected.find(f=>f?.definition?.kind===entry.kind&&optionHasId(entry,f.definition.index))
let sequence=0
const matches=computed(()=>entries.value.filter(e=>e.kind===kind.value&&`${e.name} ${e.displayName??''} ${e.sourcePack??''}`.toLowerCase().includes(query.value.toLowerCase())))
const duplicate=(entry:Entry)=>props.selected.some(f=>f?.definition?.kind===entry.kind&&optionHasId(entry,f.definition.index))
const prerequisite=computed(()=>{const value=chosen.value?.optionBuilder?.prerequisites??chosen.value?.prerequisites??chosen.value?.details?.[':prereqs'];return typeof value==='string'?value:Array.isArray(value)?value.map(v=>typeof v==='string'?v:JSON.stringify(v)).join('\n'):''})
async function load(){const run=++sequence;loading.value=true;error.value='';const owner=auth.user?.id
 try{const data=await api.get<Partial<Record<ManualOptionKind,HomebrewReference[]>>>('/api/workshop/options/choices',{timeoutMs:30000});if(run!==sequence||owner!==auth.user?.id)return
 entries.value=MANUAL_OPTION_KINDS.flatMap(kind=>(data[kind]??[]).map(e=>({...e,kind})));loaded.value=true}
 catch{if(run===sequence&&owner===auth.user?.id)error.value='The option library could not load. Saved selections are kept. Use Browse or Refresh to retry.'}
 finally{if(run===sequence)loading.value=false}
}
function inspect(entry:Entry){const current=existing(entry),saved=props.reviewed?.find(d=>d.kind===entry.kind&&sameOptionIdentity({...d.entry,index:d.index,name:String(d.entry.name)},entry));chosen.value=saved?{...saved.entry,index:saved.index,name:String(saved.entry.name),kind:entry.kind} as Entry:entry;choiceIds.value=[...(current?.definition?.choiceIds??[])];confirmed.value=false;acquired.value=current?.level??props.level}
function add(){const e=chosen.value;if(!e||duplicate(e)&&e.kind!=='selections'||choiceProblem.value||!confirmed.value||!Number.isInteger(acquired.value)||acquired.value<1||acquired.value>20)return;emit('add',{...existing(e),name:e.name,description:[e.description,...(group.value?[choiceDescription(group.value,choiceIds.value)]:[])].filter(Boolean).join('\n\n'),origin:'other',level:acquired.value,definition:{version:1,kind:e.kind,index:existing(e)?.definition?.index??e.index,grantConfirmed:true,...(group.value?{choiceIds:[...choiceIds.value]}:{})}});chosen.value=null;confirmed.value=false}
watch(kind,()=>{chosen.value=null;confirmed.value=false})
watch(()=>auth.user?.id,()=>{++sequence;entries.value=[];chosen.value=null;loading.value=false;loaded.value=false;error.value=''},{flush:'sync'})
onBeforeUnmount(()=>{++sequence})
</script>
<template><section class="manual-option-picker" aria-label="Granted character options">
 <div class="manual-option-heading"><div><h3>Invocations, boons &amp; choices</h3><p>Record options granted by your class or table. These do not use feat opportunities.</p></div><button type="button" class="sheet-button" :disabled="loading" @click="load">{{loading?'Loading options…':loaded?'Refresh character options':'Browse character options'}}</button></div>
 <p v-if="error" role="alert">{{error}}</p>
 <template v-if="loaded"><div class="manual-option-toolbar"><label>Option type<select v-model="kind" aria-label="Option type"><option value="invocations">Invocations</option><option value="boons">Boons</option><option value="selections">Choice groups</option><option value="other">Reference features</option></select></label><label>Search invocations and boons<input v-model="query" type="search" /></label></div>
  <div class="manual-option-results"><button v-for="entry in matches.slice(0,40)" :key="entry.kind+entry.index" type="button" :disabled="duplicate(entry)&&entry.kind!=='selections'" @click="inspect(entry)"><strong>{{entry.displayName??entry.name}}</strong><small>{{duplicate(entry)?entry.kind==='selections'?'Edit saved choices':'Already selected':entry.sourcePack}}</small></button></div><p v-if="!matches.length">No matching {{kind}}. Import a pack or create one in the Workshop.</p><p v-else>{{matches.length}} matches{{matches.length>40?' · Showing 40; narrow the search.':''}}</p>
  <div v-if="chosen" class="manual-option-detail"><h4>{{chosen.name}}</h4><p class="manual-option-prose">{{chosen.description||'This source includes no description. Review the complete rules with your table.'}}</p><p v-if="prerequisite" class="manual-option-prose"><strong>Prerequisites</strong><br />{{prerequisite}}</p><ul v-if="entryBenefits(chosen).length"><li v-for="(row,index) in entryBenefits(chosen)" :key="index">{{benefitSummary(row)}}</li></ul>
   <p v-if="existing(chosen)&&group" class="manual-option-prose">Editing the approved choice tree. Review source changes separately. If a changed group cannot be reviewed, remove and save this selection before adding the new definition.</p><ChoiceGroupPicker v-if="group" v-model="choiceIds" :group="group" /><p v-if="choiceProblem" role="status">{{choiceProblem}}</p><p v-if="chosen.kind==='selections'&&!group">This import contains descriptive choices. Record your choices in the saved feature text; no offered options are granted automatically.</p><label>Acquired at level<input v-model.number="acquired" type="number" min="1" max="20" /></label><p v-if="acquired>level">Its supported grants stay inactive until your character reaches this level.</p>
   <label class="manual-option-confirm"><input v-model="confirmed" type="checkbox" /> I have reviewed the prerequisites and confirmed that my class or table grants this option.</label><p>Class limits and special choices need your review. Record effects that are not supported automatically in your features or notes.</p>
   <button type="button" class="sheet-button sheet-button-primary" :disabled="!confirmed||!!choiceProblem||duplicate(chosen)&&chosen.kind!=='selections'||!Number.isInteger(acquired)||acquired<1||acquired>20" @click="add">{{existing(chosen)&&chosen.kind==='selections'?'Update choice group in draft':`Add ${optionTitle(chosen.kind)} to draft`}}</button>
  </div>
 </template>
</section></template>
<style scoped>
.manual-option-picker{display:grid;gap:16px;padding:20px 0;margin-top:20px;border-top:1px solid var(--cb-line);color:var(--cb-ink)}.manual-option-heading{display:flex;justify-content:space-between;align-items:start;gap:16px;flex-wrap:wrap}.manual-option-picker h3{font:21px Georgia,serif;margin:0 0 8px}.manual-option-picker h4{font:19px Georgia,serif}.manual-option-picker p{font-size:13px;line-height:1.6;margin:0;color:var(--cb-muted)}.manual-option-toolbar{display:flex;gap:16px;flex-wrap:wrap}.manual-option-picker label{display:grid;gap:6px;font-size:13px}.manual-option-picker input,.manual-option-picker select{padding:9px;border:1px solid var(--cb-line);border-radius:5px;background:var(--cb-field);color:var(--cb-ink)}.manual-option-picker .manual-option-confirm{display:flex;align-items:start;gap:10px}.manual-option-confirm input{width:auto;flex:none;margin-top:3px}.manual-option-results{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr));gap:8px;max-height:280px;overflow:auto}.manual-option-results button{padding:12px;text-align:left;border:1px solid var(--cb-line);border-radius:6px;background:var(--cb-paper);color:var(--cb-ink);cursor:pointer}.manual-option-results button:disabled{opacity:.6;cursor:default}.manual-option-results small{display:block;color:var(--cb-muted);margin-top:5px}.manual-option-detail{display:grid;gap:14px;padding:18px;border:1px solid var(--cb-line);border-radius:7px}.manual-option-prose{white-space:pre-wrap}.manual-option-picker .sheet-button{border:1px solid var(--cb-line);border-radius:6px;background:var(--cb-soft);color:var(--cb-ink);padding:10px 14px;cursor:pointer;font-size:13px}.manual-option-picker .sheet-button-primary{background:var(--cb-accent-text);color:var(--cb-paper)}.manual-option-picker button:disabled{opacity:.6;cursor:default}.manual-option-picker button:focus-visible,.manual-option-picker input:focus-visible,.manual-option-picker select:focus-visible{outline:2px solid var(--cb-accent-text);outline-offset:3px}
</style>
