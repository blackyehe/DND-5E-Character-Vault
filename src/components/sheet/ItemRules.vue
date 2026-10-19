<script setup lang="ts">
import type { EquipmentItem } from '../../../shared/character'
import FeatureText from './FeatureText.vue'
import { computed } from 'vue'
import { itemClassificationLabel,titleCase } from '../../../shared/item-classification'
const props=defineProps<{item:Partial<EquipmentItem>}>()
const classification=computed(()=>itemClassificationLabel({...props.item,name:props.item.name??'',qty:props.item.qty??1,weight:props.item.weight??0,equipped:props.item.equipped??false,notes:props.item.notes??''}))
const blocks=computed(()=>{
  const seen=new Set<string>()
  return [props.item.description,props.item.referenceDescription,props.item.notes].flatMap(text=>(text??'').split(/\n\s*\n/)).filter(text=>{
    const key=text.toLowerCase().replace(/\s+/g,' ').trim()
    if(!key||/^Imported item: check weight and special effects\.$/i.test(key)||seen.has(key))return false
    seen.add(key);return true
  })
})
</script>
<template>
  <div class="sheet-item-rules">
    <p v-if="classification" class="sheet-small">{{classification}}</p>
    <p v-if="item.index&&(item.weapon||item.armor)" class="sheet-small">Base type: {{titleCase(item.index.replaceAll('-',' '))}}</p>
    <p v-if="item.value" class="sheet-small">Value: {{item.value.amount.toLocaleString()}} {{item.value.currency.toUpperCase()}} each</p>
    <p v-if="item.requiresAttunement" class="sheet-small">Requires attunement{{item.attunementRequirement?` · ${item.attunementRequirement}`:''}}</p>
    <p v-if="item.effects?.ac||item.effects?.saves||((item.weapon||item.armor)&&item.magicBonus)" class="sheet-small">While equipped{{item.requiresAttunement?' and attuned':''}}: {{[(item.weapon||item.armor)&&item.magicBonus?`${item.magicBonus>0?'+':''}${item.magicBonus} ${item.weapon?'attack and damage':item.armor?'armour AC':'enchantment'}`:'',item.effects?.ac?`${item.effects.ac>0?'+':''}${item.effects.ac} AC`:'',item.effects?.saves?`${item.effects.saves>0?'+':''}${item.effects.saves} all saving throws`:''].filter(Boolean).join(' · ')}}</p>
    <FeatureText v-for="(block,index) in blocks" :key="index" :text="block" />
    <p v-if="!blocks.length" class="sheet-small">No additional rules recorded.</p>
  </div>
</template>
