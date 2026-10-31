<script setup lang="ts">
import {choiceNodes,type ChoiceGroup,type ChoiceNode} from '../../../shared/choice-groups'
import {benefitSummary} from '../../../shared/rule-benefits'
const props=defineProps<{group:ChoiceGroup;modelValue:string[]}>(),emit=defineEmits<{'update:modelValue':[string[]]}>()
function toggle(node:ChoiceNode,on:boolean){const removed=new Set([node.id,...(node.group?choiceNodes(node.group).map(n=>n.id):[])]);emit('update:modelValue',on?[...props.modelValue,node.id]:props.modelValue.filter(id=>!removed.has(id)))}
</script>
<template><fieldset class="choice-selection"><legend>Choose {{group.choose}} · {{group.options.filter(n=>modelValue.includes(n.id)).length}} selected</legend>
 <div v-for="node in group.options" :key="node.id"><label><input type="checkbox" :checked="modelValue.includes(node.id)" :disabled="!modelValue.includes(node.id)&&group.options.filter(n=>modelValue.includes(n.id)).length>=group.choose" @change="toggle(node,($event.target as HTMLInputElement).checked)" />{{node.name}}</label><p v-if="node.description">{{node.description}}</p><ul v-if="node.benefits.length"><li v-for="(row,index) in node.benefits" :key="index">{{benefitSummary(row)}}</li></ul>
 <ChoiceGroupPicker v-if="node.group&&modelValue.includes(node.id)" :group="node.group" :model-value="modelValue" @update:model-value="emit('update:modelValue',$event)" /></div>
</fieldset></template>
<style scoped>.choice-selection{display:grid;gap:14px;padding:16px;border:1px solid var(--cb-line);border-radius:7px;min-width:0}.choice-selection label{display:flex;gap:10px;align-items:center}.choice-selection input{width:auto}.choice-selection p{white-space:pre-wrap;font-size:13px;color:var(--cb-muted);margin:8px 0}.choice-selection .choice-selection{margin-top:12px}</style>
