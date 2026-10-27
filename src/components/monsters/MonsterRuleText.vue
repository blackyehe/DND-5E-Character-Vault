<script setup lang="ts">
import { computed } from 'vue'
import { monsterRuleText } from '../../../shared/monster-extensions'
const props=defineProps<{text:string}>()
const tokens=computed(()=>monsterRuleText(props.text).replace(/\r\n?/g,'\n').split(/(\*\*[^*\n]+\*\*|_[^_\n]+_|\*[^*\n]+\*|(?:Melee or Ranged|Melee|Ranged) (?:Weapon|Spell) Attack:|\bHit:)/g).filter(Boolean).map(value=>{
  if(value.startsWith('**')&&value.endsWith('**'))return {kind:'strong',text:value.slice(2,-2)}
  if((value.startsWith('_')&&value.endsWith('_'))||(value.startsWith('*')&&value.endsWith('*')))return {kind:'em',text:value.slice(1,-1)}
  return {kind:/Attack:$|^Hit:$/.test(value)?'em':'text',text:value}
}))
</script>
<template><span class="monster-rule-text"><template v-for="(token,index) in tokens" :key="index"><strong v-if="token.kind==='strong'">{{token.text}}</strong><em v-else-if="token.kind==='em'">{{token.text}}</em><template v-else>{{token.text}}</template></template></span></template>
