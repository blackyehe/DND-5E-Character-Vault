<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { characterBenefits } from '../../../shared/rule-benefits'
import { sheetSkill } from '../../lib/character-sheet'
import { useCharactersStore } from '../../stores/characters'
import { SKILL_ABILITY, ABILITY_KEYS, abilityMod } from '../../lib/calc'
import { pretty, signed, sheetProficiencies, XP_THRESHOLDS } from '../../lib/character-sheet'
import SheetVitalsStats from './SheetVitalsStats.vue'
import SheetDisclosure from './SheetDisclosure.vue'
const store=useCharactersStore(),c=computed(()=>store.current!),xp=ref<number|''>(''),message=ref(''),xpId=useId()
const skills=computed(()=>Object.entries(SKILL_ABILITY).map(([key,ability])=>{
  const rank=characterBenefits(c.value).skills[key]??'none'
  return {key,name:pretty(key),rank,ability,modifier:sheetSkill(c.value,key)}
}).sort((a,b)=>a.name.localeCompare(b.name)))
const proficiencies=computed(()=>sheetProficiencies(c.value))
const next=computed(()=>XP_THRESHOLDS[c.value.meta.level])
const progress=computed(()=>{const base=XP_THRESHOLDS[c.value.meta.level-1]??0,target=next.value;return target?Math.min(100,Math.max(0,(c.value.meta.xp-base)/(target-base)*100)):100})
async function addXP(){if(store.saving||!Number.isSafeInteger(xp.value)||Number(xp.value)<=0)return;const amount=Number(xp.value);try{await store.update(c.value._id,{meta:{...c.value.meta,xp:c.value.meta.xp+amount}});xp.value='';message.value=`${amount.toLocaleString()} XP added.`}catch{/* Sheet displays save errors. */}}
</script>
<template>
  <div class="sheet-section-stack sheet-summary-overview">
    <section class="sheet-panel sheet-summary-essentials" aria-label="Character statistics"><SheetVitalsStats include-max-hp /></section>
    <dl class="sheet-folio-abilities" aria-label="Ability scores"><div v-for="key in ABILITY_KEYS" :key="key"><dt>{{key.toUpperCase()}}</dt><dd><span class="sheet-ability-score">{{c.abilities[key]}}</span><small>{{signed(abilityMod(c.abilities[key]))}}</small></dd></div></dl>
    <section class="sheet-panel sheet-summary-experience">
      <h3>Experience</h3>
      <div class="sheet-experience-content">
        <div><div class="sheet-between"><strong>{{c.meta.xp.toLocaleString()}} XP</strong><span class="sheet-small">{{next===undefined?'Maximum level':`${Math.max(0,next-c.meta.xp).toLocaleString()} to level ${c.meta.level+1}`}}</span></div><progress :value="progress" max="100" aria-label="Experience toward next level" /><p v-if="next!==undefined&&c.meta.xp>=next" class="sheet-small">Level advancement available · review in Edit.</p></div>
        <form v-if="store.canEditPermanent" class="sheet-inline" @submit.prevent="addXP"><label class="sheet-sr-only" :for="xpId">Experience to add</label><input :id="xpId" v-model.number="xp" type="number" min="1" step="1" placeholder="XP earned" :disabled="store.saving" /><button class="sheet-button" :disabled="store.saving||!Number.isSafeInteger(xp)||Number(xp)<=0">Add XP</button></form>
      </div>
      <p class="sheet-sr-only" role="status">{{message}}</p>
    </section>
    <section class="sheet-panel sheet-summary-skills" aria-label="Skill proficiencies">
      <h3>Skills & proficiencies <span class="sheet-count">{{skills.length}}</span></h3>
      <ul class="sheet-trained-skills"><li v-for="skill in skills" :key="skill.key"><div><span>{{skill.name}}</span><small>{{skill.ability.toUpperCase()}} · {{skill.rank==='expert'?'Expertise':skill.rank==='prof'?'Proficient':'Not proficient'}}</small></div><strong>{{signed(skill.modifier)}}</strong></li></ul>
    </section>
    <section class="sheet-panel sheet-summary-training"><h3>Training & languages</h3><SheetDisclosure v-for="(values,group) in proficiencies" :key="group" :title="pretty(group)" :metadata="`${values.length} recorded`"><ul class="sheet-training-list"><li v-for="value in values" :key="value">{{value}}</li></ul><p v-if="!values.length" class="sheet-small">None recorded.</p></SheetDisclosure></section>
  </div>
</template>
