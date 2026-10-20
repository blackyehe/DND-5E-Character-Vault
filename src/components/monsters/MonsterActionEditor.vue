<script setup lang="ts">
import { computed } from 'vue'
import { MONSTER_ABILITIES, monsterSigned } from '../../../shared/monster-statblock'
import { MONSTER_SECTIONS, DAMAGE_TYPES, actionAttack, actionDC, actionDescription, type MonsterAction, type MonsterDraft } from '../../../shared/monster-workshop'
const props=defineProps<{rule:MonsterAction;monster:MonsterDraft}>()
const description=computed(()=>actionDescription(props.monster,props.rule))
</script>
<template>
  <div class="mw-rule-editor">
    <div class="mw-fields"><label>Rule name<input v-model="rule.name" maxlength="250"></label><label>Section<select v-model="rule.section"><option v-for="s in MONSTER_SECTIONS" :key="s.key" :value="s.key">{{s.name}}</option></select></label><label>Rule format<select v-model="rule.mode"><option value="text">Written rule</option><option value="attack">Attack</option><option value="save">Saving throw effect</option></select></label><label>Uses / recharge<input v-model="rule.usage" maxlength="250" placeholder="e.g. 3/Day or Recharge 5–6"></label></div>
    <template v-if="rule.mode!=='text'">
      <div class="mw-fields"><label>Calculation ability<select v-model="rule.ability"><option v-for="a in MONSTER_ABILITIES" :key="a" :value="a">{{a.toUpperCase()}}</option></select></label><label v-if="rule.mode==='attack'">Attack type<select v-model="rule.attackType"><option>Melee Weapon Attack</option><option>Ranged Weapon Attack</option><option>Melee or Ranged Weapon Attack</option><option>Melee Spell Attack</option><option>Ranged Spell Attack</option></select></label><label v-else>Target saving throw<select v-model="rule.saveAbility"><option v-for="a in MONSTER_ABILITIES" :key="a" :value="a">{{a.toUpperCase()}}</option></select></label><label v-if="rule.mode==='attack'">Reach / range<input v-model="rule.reach" placeholder="5 ft. or 80/320 ft." maxlength="250"></label><label>Target / area<input v-model="rule.target" placeholder="one target; creatures in a 15-foot cone" maxlength="2000"></label><label>Damage dice (blank for a non-damaging save effect)<input v-model="rule.damage" placeholder="2d6 + 1" maxlength="40"></label><label>Damage type<select v-model="rule.damageType"><option v-for="t in DAMAGE_TYPES" :key="t">{{t}}</option></select></label></div>
      <label class="mw-check"><input v-model="rule.addAbility" type="checkbox">Add the calculation ability modifier to damage</label>
      <label v-if="rule.mode==='attack'" class="mw-check"><input v-model="rule.proficient" type="checkbox">Add proficiency to the attack</label>
      <label>Additional damage / effects<input v-model="rule.extraDamage" maxlength="2000" placeholder="e.g. 1d6 necrotic damage"></label>
      <div class="mw-calculation">{{rule.mode==='attack'?'Attack bonus':'Save DC'}} <strong>{{rule.mode==='attack'?monsterSigned(actionAttack(monster,rule)):actionDC(monster,rule)}}</strong><span>Uses this creature's scores and proficiency unless overridden.</span></div>
      <details><summary>Override the calculated {{rule.mode==='attack'?'attack bonus':'save DC'}}</summary><label v-if="rule.mode==='attack'">Fixed attack bonus (blank = calculated)<input v-model.number="rule.attackOverride" type="number" min="-100" max="100" @change="rule.attackOverride=typeof rule.attackOverride==='number'?rule.attackOverride:null"></label><label v-else>Fixed save DC (blank = calculated)<input v-model.number="rule.dcOverride" type="number" min="0" max="100" @change="rule.dcOverride=typeof rule.dcOverride==='number'?rule.dcOverride:null"></label></details>
    </template>
    <label>{{rule.mode==='save'?'Effect, targets and result on a successful save':rule.mode==='attack'?'Additional rule text':'Description'}}<textarea v-model="rule.description" rows="5" maxlength="20000" :placeholder="rule.mode==='save'?'Describe the area, targets, duration, and whether a successful save halves damage or avoids the effect.':'Write the full rule.'"></textarea></label>
    <details><summary>Reusable names, calculations & formatting</summary><p class="hw-hint">[MON] = shortened name; [MONS] = plural; [STR ATK] = STR + proficiency; [CON SAVE] = CON save DC; [STR 2D6] = average damage and STR modifier; [3D8] = dice average. Use **bold** and _italics_.</p><p class="hw-hint">Stored actions keep these formulas. Each monster calculates them from its own statistics. Fixed values stay fixed.</p></details>
    <details><summary>Read this rule for {{monster.name||'the preview creature'}}</summary><p class="mw-rule-text">{{description}}</p></details>
  </div>
</template>
