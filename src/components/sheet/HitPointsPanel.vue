<script setup lang="ts">
import { computed, ref } from 'vue'
import { useCharactersStore, type Character } from '../../stores/characters'
import { abilityMod, profBonus } from '../../lib/calc'
import { sheetAC, signed } from '../../lib/character-sheet'
defineProps<{ compact?:boolean }>()
const store=useCharactersStore(),c=computed(()=>store.current!),amount=ref(1)
async function combat(patch:Partial<Character['combat']>){if(store.saving)return;try{await store.update(c.value._id,{combat:{...c.value.combat,...patch}})}catch{/* The sheet displays save errors. */}}
function hp(value:string,kind:'hpCurrent'|'hpTemp'){const n=Number(value);if(Number.isInteger(n))void combat({[kind]:Math.max(0,Math.min(kind==='hpCurrent'?c.value.combat.hpMax:9999,n))})}
function changeHP(heal:boolean,value=amount.value){
  if(!Number.isInteger(value)||value<1)return
  const v=c.value.combat
  if(heal)void combat({hpCurrent:Math.min(v.hpMax,v.hpCurrent+value)})
  else{const absorbed=Math.min(v.hpTemp,value);void combat({hpTemp:v.hpTemp-absorbed,hpCurrent:Math.max(0,v.hpCurrent-value+absorbed)})}
}
</script>
<template>
  <section class="sheet-panel sheet-hit-points" :class="{'sheet-hit-points-compact':compact}">
    <div v-if="compact" class="sheet-between"><h3>Hit points</h3><span class="sheet-small">Temp {{c.combat.hpTemp}}</span></div>
    <h3 v-else>Vitals</h3>
    <fieldset :disabled="store.saving">
      <template v-if="compact">
        <div class="sheet-hp-quick"><p aria-label="Current and maximum hit points"><strong>{{c.combat.hpCurrent}}</strong> / {{c.combat.hpMax}}</p><div><button type="button" class="sheet-button" :disabled="c.combat.hpCurrent<=0&&c.combat.hpTemp<=0" aria-label="Take 1 damage" @click="changeHP(false,1)">−1</button><button type="button" class="sheet-button" :disabled="c.combat.hpCurrent>=c.combat.hpMax" aria-label="Heal 1 hit point" @click="changeHP(true,1)">+1</button></div></div>
        <p class="sheet-small">AC {{sheetAC(c)}} · Proficiency {{signed(profBonus(c.meta.level))}}</p>
      </template>
      <div v-else class="sheet-three-columns" style="text-align:center"><div><span class="sheet-small">Armor class</span><div class="sheet-controls"><strong>{{sheetAC(c)}}</strong></div></div><div><span class="sheet-small">Initiative</span><div class="sheet-controls"><strong>{{signed(abilityMod(c.abilities.dex))}}</strong></div></div><div><span class="sheet-small">Speed</span><div class="sheet-controls"><strong>{{c.combat.speed}}<small style="font-size:12px"> ft.</small></strong></div></div></div>
      <component :is="compact?'details':'div'" class="sheet-hp-adjustments">
        <summary v-if="compact">Adjust HP / temporary HP</summary><hr v-else />
        <div class="sheet-three-columns"><label>Current HP<input :value="c.combat.hpCurrent" type="number" min="0" :max="c.combat.hpMax" @change="hp(($event.target as HTMLInputElement).value,'hpCurrent')" /></label><label>Maximum HP<output>{{c.combat.hpMax}}</output></label><label>Temporary HP<input :value="c.combat.hpTemp" type="number" min="0" @change="hp(($event.target as HTMLInputElement).value,'hpTemp')" /></label></div>
        <div class="sheet-inline sheet-hp-adjustment"><label style="flex:1">Damage / healing<input v-model.number="amount" type="number" min="1" /></label><button type="button" class="sheet-button" :disabled="!Number.isInteger(amount)||amount<1" @click="changeHP(false)">Damage</button><button type="button" class="sheet-button" :disabled="!Number.isInteger(amount)||amount<1" @click="changeHP(true)">Heal</button></div><p class="sheet-small sheet-hp-hint">Damage uses temporary HP first.</p>
      </component>
    </fieldset>
  </section>
</template>
