<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { characterBenefits } from '../../../shared/rule-benefits'
import {sheetSkillRows,sheetSave,benefitSpellAttack,benefitSpellDC} from '../../lib/character-sheet'
import {combatAttacks} from '../../lib/equipment'
import {restUpdate} from '../../../shared/character-rest'
import {slotsFor} from '../../../shared/character-progression'
import { useCharactersStore } from '../../stores/characters'
import { ABILITY_KEYS, abilityMod } from '../../lib/calc'
import { pretty, signed, sheetProficiencies, XP_THRESHOLDS } from '../../lib/character-sheet'
import SheetVitalsStats from './SheetVitalsStats.vue'
import SheetDisclosure from './SheetDisclosure.vue'
const store=useCharactersStore(),c=computed(()=>store.current!),xp=ref<number|''>(''),message=ref(''),xpId=useId()
const benefits=computed(()=>characterBenefits(c.value))
const skills=computed(()=>sheetSkillRows(c.value,benefits.value))
const proficiencies=computed(()=>sheetProficiencies(c.value,benefits.value))
const saves=computed(()=>ABILITY_KEYS.map(key=>({key,modifier:sheetSave(c.value,key,benefits.value),proficient:!!benefits.value.saves[key]})))
const attacks=computed(()=>combatAttacks(c.value,benefits.value))
const hasMagic=computed(()=>c.value.spellcasting.known.length||c.value.spellcasting.prepared.length||Object.values(slotsFor(c.value)).some(s=>s.max>0)||benefits.value.spellAttack||benefits.value.spellDC)
const resting=ref(false),restMessage=ref('')
async function longRest(){
 if(store.saving||resting.value)return
 const { _id:id,updatedAt }=c.value;resting.value=true;restMessage.value=''
 try{await store.update(id,restUpdate(c.value,'long'),{expectedUpdatedAt:updatedAt});if(c.value._id===id)restMessage.value='Long rest applied. Eligible spell slots and resources recovered.'}
 catch{/* The sheet displays the save error and retains saved values. */}
 finally{resting.value=false}
}
const next=computed(()=>XP_THRESHOLDS[c.value.meta.level])
const progress=computed(()=>{const base=XP_THRESHOLDS[c.value.meta.level-1]??0,target=next.value;return target?Math.min(100,Math.max(0,(c.value.meta.xp-base)/(target-base)*100)):100})
async function addXP(){if(store.saving||!Number.isSafeInteger(xp.value)||Number(xp.value)<=0)return;const amount=Number(xp.value);try{await store.update(c.value._id,{meta:{...c.value.meta,xp:c.value.meta.xp+amount}});xp.value='';message.value=`${amount.toLocaleString()} XP added.`}catch{/* Sheet displays save errors. */}}
</script>
<template>
  <div class="sheet-section-stack sheet-summary-overview">
    <section class="sheet-panel sheet-summary-rest" aria-label="Rest controls"><div><h3>Rest & recovery</h3><p class="sheet-small">Recover spell slots and rest-based uses. HP and hit dice are managed separately.</p></div><button type="button" class="sheet-button sheet-button-primary" :disabled="store.saving||resting" @click="longRest">{{resting?'Resting…':'Long rest'}}</button><p v-if="restMessage" class="sheet-small" role="status">{{restMessage}}</p></section>
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
    <section class="sheet-panel" aria-label="Saving throws"><h3>Saving throws</h3><dl class="sheet-summary-saves"><div v-for="save in saves" :key="save.key"><dt>{{save.key.toUpperCase()}}</dt><dd>{{signed(save.modifier)}}<small>{{save.proficient?'Proficient':'Not proficient'}}</small></dd></div></dl></section>
    <section class="sheet-panel" aria-label="Combat summary"><h3>Combat at a glance</h3><dl v-if="hasMagic" class="sheet-summary-magic"><div><dt>Spell attack</dt><dd>{{signed(benefitSpellAttack(c,benefits))}}</dd></div><div><dt>Spell save DC</dt><dd>{{benefitSpellDC(c,benefits)}}</dd></div><div><dt>Casting ability</dt><dd>{{c.spellcasting.ability.toUpperCase()}}</dd></div></dl><ul v-if="attacks.length" class="sheet-summary-attacks"><li v-for="(attack,index) in attacks" :key="index"><strong>{{attack.name}}</strong><span>Attack {{signed(attack.toHit)}}</span><span>{{attack.text}} {{attack.damageType}}</span></li></ul><p v-else class="sheet-small">No weapon or custom attacks recorded. Equip a weapon or add an attack in Edit character.</p></section>
    <section class="sheet-panel sheet-summary-training"><h3>Training & languages</h3><SheetDisclosure v-for="(values,group) in proficiencies" :key="group" :title="pretty(group)" :metadata="`${values.length} recorded`"><ul class="sheet-training-list"><li v-for="value in values" :key="value">{{value}}</li></ul><p v-if="!values.length" class="sheet-small">None recorded.</p></SheetDisclosure></section>
  </div>
</template>
<style scoped>
.sheet-summary-rest{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.sheet-summary-rest h3,.sheet-summary-rest p{margin:0}.sheet-summary-rest>div{flex:1 1 220px}.sheet-summary-rest>button{min-height:44px;flex-shrink:0}.sheet-summary-rest>p{flex-basis:100%}
.sheet-summary-saves,.sheet-summary-magic{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;font-variant-numeric:tabular-nums}.sheet-summary-saves>div,.sheet-summary-magic>div{min-width:0;border-bottom:1px solid var(--cb-line);padding-bottom:8px}.sheet-summary-saves dd,.sheet-summary-magic dd{font-size:23px;margin:0}.sheet-summary-saves small{display:block;font-size:11px;color:var(--cb-muted)}.sheet-summary-magic{margin-bottom:16px}.sheet-summary-magic dt{font-size:12px}
.sheet-summary-attacks{list-style:none;padding:0;margin:0}.sheet-summary-attacks>li{display:flex;gap:8px 20px;align-items:baseline;flex-wrap:wrap;padding:10px 0;border-bottom:1px solid var(--cb-line);font-variant-numeric:tabular-nums}.sheet-summary-attacks strong{flex:1 1 180px;overflow-wrap:anywhere}.sheet-summary-attacks span{overflow-wrap:anywhere}
</style>
