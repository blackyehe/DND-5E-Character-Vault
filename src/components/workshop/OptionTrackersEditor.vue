<script setup lang="ts">
import {computed} from 'vue'
import {newOptionTracker,optionTrackerProblems,type OptionTracker} from '../../../shared/option-trackers'
const props=defineProps<{modelValue:OptionTracker[]}>()
const emit=defineEmits<{'update:modelValue':[OptionTracker[]]}>()
const issue=computed(()=>optionTrackerProblems(props.modelValue)[0])
function change(index:number,patch:Partial<OptionTracker>){emit('update:modelValue',props.modelValue.map((t,i)=>i===index?{...t,...patch}:t))}
</script>
<template>
 <section>
  <h2>Linked trackers</h2>
  <p class="hw-hint">Characters receive these pools when they acquire this option. Removing the grant removes its trackers. Renames and added or removed pools follow reviewed source updates, preserving spent uses.</p>
  <fieldset v-for="(t,index) in modelValue" :key="t.id" class="hw-form-grid">
   <legend>Tracker {{index+1}}</legend>
   <label>Tracker name<input :value="t.name" required maxlength="200" @input="change(index,{name:($event.target as HTMLInputElement).value})" /></label>
   <label>Total uses<input :value="t.max" type="number" required min="1" max="999" step="1" @input="change(index,{max:Number(($event.target as HTMLInputElement).value)})" /></label>
   <label>Recovers on<select :value="t.recovery" @change="change(index,{recovery:($event.target as HTMLSelectElement).value as OptionTracker['recovery']})"><option value="long">Long rest</option><option value="short">Short or long rest</option><option value="manual">Manual recovery</option></select></label>
   <label>Unlocks at character level<input :value="t.level" type="number" required min="1" max="20" step="1" @input="change(index,{level:Number(($event.target as HTMLInputElement).value)})" /></label>
   <label>Tracker notes<textarea :value="t.notes" rows="2" maxlength="10000" @input="change(index,{notes:($event.target as HTMLTextAreaElement).value})" /></label>
   <button type="button" class="hw-text-button" @click="emit('update:modelValue',modelValue.filter((_,i)=>i!==index))">Remove tracker</button>
  </fieldset>
  <p v-if="issue" class="hw-alert" role="alert">{{issue}}</p>
  <button type="button" class="hw-button" :disabled="modelValue.length>=20" @click="emit('update:modelValue',[...modelValue,newOptionTracker()])">+ Add tracker</button>
  <p class="hw-hint">Each tracker has a fixed maximum. Existing class and race resource editors remain available for their level-based rules.</p>
 </section>
</template>
