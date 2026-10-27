<script setup lang="ts">
import {computed,onMounted,ref,watch} from 'vue'
import {api} from '../../lib/api'
import {cloneEntry,type CompendiumKind,type EntryData} from '../../../shared/compendium-editing'
import {entryRuleDraft,entryMonsterDraft,entryItemDraft,entrySpellDraft,entryOptionDraft} from '../../../shared/entry-builders'
import {EXAMPLE_SPELLS} from '../../../shared/entry-builder-examples'
import {entryBenefits} from '../../../shared/rule-benefits'
import {WORKSHOP_STEPS,type WorkshopStep} from '../../../shared/homebrew-workshop'
import {MONSTER_STEPS,MONSTER_SECTIONS,compileMonster,newMonsterAction,type MonsterStep} from '../../../shared/monster-workshop'
import type {EquipmentItem} from '../../../shared/character'
import WorkshopEditor from '../workshop/WorkshopEditor.vue'
import WorkshopPreview from '../workshop/WorkshopPreview.vue'
import MonsterCoreFields from '../monsters/MonsterCoreFields.vue'
import MonsterActionEditor from '../monsters/MonsterActionEditor.vue'
import MonsterStatblock from '../monsters/MonsterStatblock.vue'
import ItemComposer from '../items/ItemComposer.vue'
import ItemRules from '../sheet/ItemRules.vue'
import ReferenceEntryBuilder from './ReferenceEntryBuilder.vue'
import RuleBenefitsEditor from './RuleBenefitsEditor.vue'
import type {SrdRef} from '../../lib/srd'
import '../workshop/workshop.css'
import '../monsters/monster-workshop.css'
const props=defineProps<{modelValue:EntryData;kind:CompendiumKind;demo?:boolean}>()
const emit=defineEmits<{'update:modelValue':[entry:EntryData]}>()
const base=cloneEntry(props.modelValue),step=ref('identity'),level=ref(6),scores=ref({str:16,dex:16,con:16,int:16,wis:16,cha:16})
const ruleKind=({classes:'class',subclasses:'subclass',races:'race',subraces:'race'} as const)[props.kind as 'classes'],rule=ref(ruleKind?entryRuleDraft(base,ruleKind):null),monster=ref(props.kind==='monsters'?entryMonsterDraft(base):null),item=ref(['equipment','magic-items'].includes(props.kind)?entryItemDraft(base,props.kind==='magic-items'):null),spell=ref(props.kind==='spells'?entrySpellDraft(base):null),option=ref(!ruleKind&&!monster.value&&!item.value&&!spell.value?entryOptionDraft(base):null),benefits=ref(entryBenefits(base))
const classes=ref<SrdRef[]>([]),spells=ref<SrdRef[]>([]),loadError=ref(''),selectedRule=ref(monster.value?.rules[0]?.id??'')
const steps=computed(()=>rule.value?[...WORKSHOP_STEPS.filter(s=>s.key!=='review').map(s=>({key:s.key,label:s.name})),{key:'benefits',label:'Benefits'},{key:'review',label:'Review'}]:monster.value?MONSTER_STEPS.map(([key,label])=>({key,label})):item.value?[{key:'identity',label:'Item definition'},{key:'benefits',label:'Benefits'},{key:'review',label:'Review'}]:spell.value?[{key:'identity',label:'Spell'},{key:'casting',label:'Casting'},{key:'effects',label:'Targets & effects'},{key:'benefits',label:'Benefits'},{key:'review',label:'Review'}]:[{key:'identity',label:props.kind==='languages'?'Language':'Identity & rules'},...(props.kind==='languages'?[]:[{key:'options',label:props.kind==='backgrounds'?'Feature & equipment':'Features & choices'}]),{key:'benefits',label:'Benefits'},{key:'review',label:'Review'}])
function publishDraft(){emit('update:modelValue',{...base,...(rule.value?{workshop:cloneEntry(rule.value)}:{}),...(monster.value?{monsterDraft:cloneEntry(monster.value)}:{}),...(item.value?{workshopItem:cloneEntry(item.value)}:{}),...(spell.value?{spellBuilder:cloneEntry(spell.value)}:{}),...(option.value?{optionBuilder:cloneEntry(option.value)}:{}),benefits:cloneEntry(benefits.value)})}
watch([rule,monster,item,spell,option,benefits],publishDraft,{deep:true})
const currentRule=computed(()=>monster.value?.rules.find(r=>r.id===selectedRule.value)),statblock=computed(()=>monster.value?compileMonster(monster.value):null)
function changeItem(value:EquipmentItem){if(JSON.stringify(item.value)!==JSON.stringify(value))item.value=value}
function addRule(){if(!monster.value)return;const r=newMonsterAction();monster.value.rules.push(r);selectedRule.value=r.id}
function removeRule(){if(!monster.value)return;monster.value.rules=monster.value.rules.filter(r=>r.id!==selectedRule.value);selectedRule.value=monster.value.rules[0]?.id??''}
async function loadChoices(){if(!rule.value)return;if(props.demo){classes.value=[{index:'fighter',name:'Fighter',url:''}];spells.value=EXAMPLE_SPELLS;return}loadError.value='';const requests=await Promise.allSettled([api.get<{results:SrdRef[]}>('/api/2014/classes'),api.get<SrdRef[]>('/api/content/homebrew/classes'),api.get<{results:SrdRef[]}>('/api/2014/spells'),api.get<SrdRef[]>('/api/content/homebrew/spells')]);classes.value=requests.slice(0,2).flatMap(r=>r.status==='fulfilled'?Array.isArray(r.value)?r.value:r.value.results:[]);spells.value=requests.slice(2).flatMap(r=>r.status==='fulfilled'?Array.isArray(r.value)?r.value:r.value.results:[]);if(requests.some(r=>r.status==='rejected'))loadError.value='Some class or spell choices could not load. Existing selections are kept.'}
onMounted(()=>void loadChoices())
</script>
<template><div class="entry-builder hw-page" :data-builder="kind"><nav class="entry-builder-steps" aria-label="Entry builder sections"><button v-for="s in steps" :key="s.key" type="button" class="hw-button" :class="{'hw-button-primary':step===s.key}" :aria-current="step===s.key?'step':undefined" @click="step=s.key">{{s.label}}</button></nav><p v-if="loadError" class="hw-alert" role="alert">{{loadError}} <button type="button" class="hw-text-button" @click="loadChoices">Retry choices</button></p><div class="entry-builder-workspace" :class="{'entry-builder-with-preview':!!rule||!!monster}">
 <div class="entry-builder-content">
 <RuleBenefitsEditor v-if="step==='benefits'&&(rule||item)" v-model="benefits" :kind="kind" :spell-choices="demo?EXAMPLE_SPELLS:undefined" />
 <WorkshopEditor v-else-if="rule" :draft="rule" :step="step as WorkshopStep" :classes="classes" :spells="spells" personal-edition @step="step=$event" @save="step='review'" @publish="step='review'" />
 <section v-else-if="monster" class="hw-panel mw-editor"><MonsterCoreFields v-if="!['rules','review'].includes(step)" :draft="monster" :step="step as MonsterStep" /><template v-else-if="step==='rules'"><h2>Traits & actions</h2><label v-if="monster.rules.length">Editing rule<select v-model="selectedRule" aria-label="Editing rule"><option v-for="r in monster.rules" :key="r.id" :value="r.id">{{r.name}} · {{MONSTER_SECTIONS.find(s=>s.key===r.section)?.name}}</option></select></label><button type="button" class="hw-button" @click="addRule">Add rule</button><template v-if="currentRule"><MonsterActionEditor :rule="currentRule" :monster="monster" /><button type="button" class="hw-text-button" @click="removeRule">Remove from creature</button></template></template><template v-else><h2>Review creature</h2><p class="hw-hint">Review the complete statblock, then Save changes below.</p></template></section>
 <template v-else-if="item"><ItemComposer v-if="step==='identity'" mode="entry" :initial="item" @change="changeItem" /><section v-else class="hw-panel"><h2>Review item</h2><h3>{{item.name}}</h3><ItemRules :item="item" /><p v-if="item.weapon">{{item.weapon.dice}} {{item.weapon.damageType}} · {{item.weapon.range}}</p><p v-if="item.armor">Base AC: {{item.armor.base}}</p><p class="hw-hint">Save this edition, then review existing characters individually.</p></section></template>
 <ReferenceEntryBuilder v-else :kind="kind" :step="step" :spell="spell??undefined" :option="option??undefined" :benefits="benefits" :spell-choices="demo?EXAMPLE_SPELLS:undefined" @benefits="benefits=$event" />
 </div>
 <aside v-if="rule" class="entry-builder-preview"><WorkshopPreview :draft="rule" :step="step==='benefits'?'features':step as WorkshopStep" :level="level" :scores="scores" @level="level=$event" @score="(key,value)=>scores[key]=value" @step="step=$event" /></aside><aside v-if="statblock" class="entry-builder-preview"><h3>Live creature preview</h3><MonsterStatblock :monster="statblock" editable @edit="step=$event" /></aside>
 </div><footer class="entry-builder-navigation"><button type="button" class="hw-button" :disabled="steps[0]?.key===step" @click="step=steps[Math.max(0,steps.findIndex(s=>s.key===step)-1)]!.key">Back</button><button v-if="step!=='review'" type="button" class="hw-button hw-button-primary" @click="step=steps[Math.min(steps.length-1,steps.findIndex(s=>s.key===step)+1)]!.key">Continue</button></footer></div></template>
