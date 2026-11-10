<script setup lang="ts">
import type { EquipmentItem } from '../../../shared/character'
import FeatureText from './FeatureText.vue'
import { computed } from 'vue'
import { itemClassificationLabel,titleCase } from '../../../shared/item-classification'
import { benefitField,benefitSummary } from '../../../shared/rule-benefits'
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
    <div v-if="item.trackers?.length" class="sheet-small"><strong>Linked trackers</strong><ul><li v-for="tracker in item.trackers" :key="tracker.id">{{tracker.name}}: {{tracker.max}} uses · {{tracker.recovery==='manual'?'manual recovery':`${tracker.recovery} rest`}} · {{tracker.activation==='carried'?'while carried':tracker.activation==='equipped'?'while equipped':'while attuned'}}<span v-if="tracker.notes"> · {{tracker.notes}}</span></li></ul></div>
    <div v-if="item.benefits?.length" class="sheet-small"><strong>Benefits while equipped{{item.requiresAttunement?' and attuned':''}}</strong><ul><li v-for="(row,index) in item.benefits" :key="index">{{benefitSummary(row)}} · Level {{benefitField(row,'level')??1}}</li></ul></div>
    <p v-if="!blocks.length" class="sheet-small">No additional rules recorded.</p>
  </div>
</template>
