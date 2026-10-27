<script setup lang="ts">
import type { MonsterAction } from '../../../shared/monster-workshop'
import { MONSTER_ABILITIES } from '../../../shared/monster-statblock'
const props=defineProps<{rule:MonsterAction}>()
props.rule.spellcasting??={ability:'int',dc:null,attack:null,header:'',footer:'',groups:[]}
const s=props.rule.spellcasting
function number(event:Event,key:'dc'|'attack'){const value=(event.target as HTMLInputElement).value;s[key]=value===''?null:Number(value)}
</script>
<template>
  <div class="mw-fields"><label>Spellcasting ability<select v-model="s.ability"><option v-for="a in MONSTER_ABILITIES" :key="a" :value="a">{{a.toUpperCase()}}</option></select></label><label>Printed spell save DC<input :value="s.dc??''" type="number" min="0" max="100" @input="number($event,'dc')"></label><label>Printed spell attack bonus<input :value="s.attack??''" type="number" min="-100" max="100" @input="number($event,'attack')"></label></div>
  <p class="hw-hint">Blank values stay unrecorded. Printed DCs and attack bonuses are preserved without recalculation. Choose the action or reaction section above to retain timing.</p>
  <label>Spellcasting introduction<textarea v-model="s.header" rows="3" maxlength="20000"></textarea></label>
  <fieldset v-for="(group,i) in s.groups" :key="i" class="mw-spell-group"><legend>Spell list {{i+1}}</legend><label>Usage / spell level<input v-model="group.label" maxlength="250" placeholder="At will, 1/day each, 1st level (4 slots), etc."></label>
    <div v-for="(spell,j) in group.spells" :key="j" class="mw-fields"><label>Spell name<input v-model="spell.name" maxlength="250"></label><label>Source ID<input v-model="spell.source" maxlength="250" placeholder="XPHB"></label><label>Edition<input v-model="spell.edition" maxlength="250" placeholder="2024"></label><button class="hw-text-button" @click="group.spells.splice(j,1)">Remove spell {{j+1}}</button></div>
    <div class="hw-actions"><button class="hw-button" :disabled="group.spells.length>=100" @click="group.spells.push({name:'',source:'',edition:''})">+ Spell</button><button class="hw-text-button" @click="s.groups.splice(i,1)">Remove list</button></div>
  </fieldset>
  <button class="hw-button" :disabled="s.groups.length>=30" @click="s.groups.push({label:'',spells:[{name:'',source:'',edition:''}]})">+ Spell list</button>
  <label>Spellcasting ending / exceptions<textarea v-model="s.footer" rows="3" maxlength="20000"></textarea></label>
  <p class="hw-hint">Spell references remain source-qualified text. Availability in your library has not been verified.</p>
</template>
