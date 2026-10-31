<script setup lang="ts">
import {onMounted,ref} from 'vue'
import type {SubraceOption} from '../../../shared/subrace-options'
import {ABILITY_KEYS} from '../../../shared/calc'
import {api} from '../../lib/api'
const props=defineProps<{value:SubraceOption}>(),parents=ref<{index:string;name:string;displayName?:string}[]>([]),error=ref('')
async function load(){error.value='';try{parents.value=await api.get('/api/workshop/options/parents')}catch{error.value='Parent races could not load. Your selection is kept; retry before saving.'}}
function select(index:string){props.value.parentIndex=index;props.value.parentName=parents.value.find(e=>e.index===index)?.name??props.value.parentName}
onMounted(load)
</script>
<template><section class="subrace-fields"><h3>Parent race &amp; adjustments</h3><p class="hw-hint">The parent supplies its normal traits, ability bonuses and speed. Enter only this subrace's additional bonuses, description and Benefits. Parent rules are not copied into the subrace.</p><label>Parent race<select aria-label="Parent race" :value="value.parentIndex" @change="select(($event.target as HTMLSelectElement).value)"><option value="">Choose parent race…</option><option v-if="value.parentIndex&&!parents.some(p=>p.index===value.parentIndex)" :value="value.parentIndex">{{value.parentName}} · saved parent unavailable</option><option v-for="parent in parents" :key="parent.index" :value="parent.index">{{parent.displayName??parent.name}}</option></select></label><p v-if="error" class="hw-alert" role="alert">{{error}} <button type="button" @click="load">Retry parent races</button></p><div class="hw-form-grid"><label v-for="key in ABILITY_KEYS" :key="key">{{key.toUpperCase()}} additional bonus<input v-model.number="value.bonuses[key]" type="number" min="-5" max="5" /></label></div><label>Speed override (leave blank to inherit)<input :value="value.speed??''" type="number" min="0" max="1000" @input="value.speed=($event.target as HTMLInputElement).value===''?null:Number(($event.target as HTMLInputElement).value)" /></label><p class="hw-hint">Changing a saved character's subrace identity keeps existing ability scores and speed. Review those permanent values manually; this selector does not subtract or reapply ancestry bonuses.</p></section></template>
<style scoped>.subrace-fields{display:grid;gap:16px;margin-top:20px}</style>
