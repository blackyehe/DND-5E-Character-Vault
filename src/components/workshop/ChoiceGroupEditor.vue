<script setup lang="ts">
import {newChoiceNode,newChoiceGroup,type ChoiceGroup} from '../../../shared/choice-groups'
import RuleBenefitsEditor from '../compendium/RuleBenefitsEditor.vue'
const props=withDefaults(defineProps<{group:ChoiceGroup;depth?:number}>(),{depth:1})
</script>
<template><fieldset class="choice-tree-editor"><legend>{{depth===1?'Choice group':'Nested choice group'}}</legend>
 <label>Number to choose<input v-model.number="group.choose" type="number" min="1" max="100" /></label>
 <p class="hw-hint">Renaming an option keeps existing selections linked. Removing an option leaves approved character rules available.</p>
 <section v-for="(node,index) in group.options" :key="node.id" class="choice-tree-node">
  <label>Option name<input v-model="node.name" maxlength="200" /></label><label>Option description<textarea v-model="node.description" rows="3" /></label>
  <details><summary>Option Benefits</summary><RuleBenefitsEditor :model-value="node.benefits" kind="selections" @update:model-value="node.benefits=$event" /></details>
  <ChoiceGroupEditor v-if="node.group" :group="node.group" :depth="depth+1" />
  <div class="hw-actions"><button v-if="!node.group&&depth<4" type="button" class="hw-button" @click="node.group=newChoiceGroup()">Add nested group</button><button v-if="node.group" type="button" class="hw-button" @click="delete node.group">Remove nested group</button><button type="button" class="hw-text-button" @click="group.options.splice(index,1)">Remove option</button></div>
 </section><button type="button" class="hw-button" :disabled="group.options.length>=100" @click="group.options.push(newChoiceNode())">Add option</button>
</fieldset></template>
<style scoped>.choice-tree-editor{display:grid;gap:16px;min-width:0;border:1px solid var(--cb-line);padding:18px;border-radius:8px}.choice-tree-node{display:grid;gap:14px;padding:16px;border:1px solid var(--cb-line);border-radius:6px}.choice-tree-node details>summary{cursor:pointer}.choice-tree-node :deep(.benefit-editor){min-width:0}</style>
