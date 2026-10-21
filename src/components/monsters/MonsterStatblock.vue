<script setup lang="ts">
import { computed } from 'vue'
import { MONSTER_ABILITIES, monsterChallenge, monsterModifier, monsterSigned, type MonsterStatblock, type MonsterRule } from '../../../shared/monster-statblock'
import MonsterRuleText from './MonsterRuleText.vue'
import '../../assets/fonts/statblock/font-faces.css'
import './monster-statblock.css'
import type { MonsterStep } from '../../../shared/monster-workshop'
const props=defineProps<{monster:MonsterStatblock;original?:unknown;editable?:boolean}>()
const emit=defineEmits<{edit:[step:MonsterStep]}>()
function editAttrs(step:MonsterStep){return props.editable?{role:'button',tabindex:0,class:'monster-editable','aria-label':`Edit ${step==='rules'?'traits and actions':step}`,onClick:()=>emit('edit',step),onKeydown:(event:KeyboardEvent)=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();emit('edit',step)}}}:{}}
const identity=computed(()=>[props.monster.size,props.monster.type+(props.monster.subtype?` (${props.monster.subtype})`:'')].filter(Boolean).join(' ')+(props.monster.alignment?`, ${props.monster.alignment}`:''))
const abilityGroups = [['str','int'],['dex','wis'],['con','cha']] as const
const abilityNames = {str:'Strength',dex:'Dexterity',con:'Constitution',int:'Intelligence',wis:'Wisdom',cha:'Charisma'}
function abilityModifier(key:typeof MONSTER_ABILITIES[number]) { const score=props.monster.abilities[key]; return score===null?'—':monsterSigned(monsterModifier(score)) }
function abilitySave(key:typeof MONSTER_ABILITIES[number]) { const save=props.monster.saves[key]; return save===undefined?'—':monsterSigned(save) }
const facts=computed(()=>[
  ['Saving Throws',MONSTER_ABILITIES.filter(key=>props.monster.saves[key]!==undefined).map(key=>`${key[0]!.toUpperCase()}${key.slice(1)} ${monsterSigned(props.monster.saves[key]!)}`).join(', ')],
  ['Skills',props.monster.skills.map(skill=>`${skill.name} ${monsterSigned(skill.bonus)}`).join(', ')],
  ['Damage Vulnerabilities',props.monster.vulnerabilities],['Damage Resistances',props.monster.resistances],
  ['Damage Immunities',props.monster.damageImmunities],['Condition Immunities',props.monster.conditionImmunities],
  ['Senses',props.monster.senses],['Languages',props.monster.languages],
  ['Challenge',monsterChallenge(props.monster.challenge)+(props.monster.xp!==null?` (${props.monster.xp.toLocaleString('en-US')} XP)`:'')],
  ['Proficiency Bonus',props.monster.proficiencyBonus!==null?monsterSigned(props.monster.proficiencyBonus):''],
].filter(([,value])=>value))
function ruleName(rule:MonsterRule){const compact=(s:string)=>s.toLowerCase().replace(/[^a-z0-9]/g,'');return rule.name+(rule.usage&&!compact(rule.name).includes(compact(rule.usage))?` (${rule.usage})`:'')}
</script>
<template>
  <div class="monster-reader">
    <p v-if="monster.missing.length" class="monster-import-notice" role="note">Not recorded in this entry: {{monster.missing.join('; ')}}.</p>
    <article class="monster-statblock" :aria-label="`${monster.name} statblock`">
      <header class="monster-heading" v-bind="editAttrs('identity')"><h2>{{monster.name}}</h2><p>{{identity||'Size and creature type not recorded'}}</p></header>
      <dl class="monster-primary-stats">
        <div v-bind="editAttrs('defenses')"><dt>Armor Class</dt><dd><template v-if="monster.armorClass.length"><template v-for="(ac,index) in monster.armorClass" :key="index">{{index?', ':''}}{{ac.value??''}}{{ac.note?(ac.value===null?ac.note:` (${ac.note})`):''}}</template></template><template v-else>Not recorded</template></dd></div>
        <div v-bind="editAttrs('statistics')"><dt>Hit Points</dt><dd>{{monster.hitPoints??'Not recorded'}}{{monster.hitDice?` (${monster.hitDice})`:''}}</dd></div>
        <div v-bind="editAttrs('defenses')"><dt>Speed</dt><dd>{{monster.speed||'Not recorded'}}</dd></div>
      </dl>
      <div class="monster-abilities" v-bind="editAttrs('statistics')">
        <table v-for="(group,index) in abilityGroups" :key="index">
          <caption class="monster-sr-only">{{group.map(key=>abilityNames[key]).join(' and ')}} scores, modifiers and recorded saving throws</caption>
          <thead><tr><th scope="col"><span class="monster-sr-only">Ability</span></th><th scope="col">Score</th><th scope="col">Mod</th><th scope="col">Save</th></tr></thead>
          <tbody><tr v-for="key in group" :key="key" :data-ability-kind="['str','dex','con'].includes(key)?'physical':'mental'">
            <th scope="row"><abbr :title="abilityNames[key]">{{key.toUpperCase()}}</abbr></th>
            <td>{{monster.abilities[key]??'—'}}</td><td>{{abilityModifier(key)}}</td><td :title="monster.saves[key]===undefined?'Saving throw not recorded':`${abilityNames[key]} saving throw`">{{abilitySave(key)}}</td>
          </tr></tbody>
        </table>
      </div>
      <dl class="monster-properties"><div v-for="[label,value] in facts" :key="label" v-bind="editAttrs(label==='Challenge'||label==='Proficiency Bonus'?'statistics':'defenses')"><dt>{{label}}</dt><dd>{{value}}</dd></div></dl>
      <section v-if="monster.description" class="monster-description" aria-label="Description" v-bind="editAttrs('identity')"><MonsterRuleText :text="monster.description" /></section>
      <section v-for="section in monster.sections" :key="section.kind" class="monster-rule-section" :aria-label="section.title" v-bind="editAttrs('rules')">
        <h3>{{section.title}}</h3>
        <p v-if="section.description" class="monster-section-intro"><MonsterRuleText :text="section.description" /></p>
        <p v-for="(rule,index) in section.entries" :key="`${index}:${rule.name}`" class="monster-rule"><strong><em>{{ruleName(rule).replace(/\.$/,'')}}.</em></strong> <MonsterRuleText :text="rule.description||'Description not recorded.'" /></p>
      </section>
    </article>
    <p class="monster-source">{{monster.source}}</p>
    <details v-if="original" class="monster-original"><summary>Original reference details</summary><pre>{{JSON.stringify(original,null,2)}}</pre></details>
  </div>
</template>
