<script setup lang="ts">
import {newLinkedTracker,itemTrackerProblems,type LinkedTracker} from '../../../shared/linked-trackers'
import {computed} from 'vue'
const props=defineProps<{modelValue:LinkedTracker[];requiresAttunement?:boolean}>()
const emit=defineEmits<{'update:modelValue':[LinkedTracker[]]}>()
const issue=computed(()=>itemTrackerProblems({trackers:props.modelValue,requiresAttunement:props.requiresAttunement})[0]??'')
function change(index:number,patch:Partial<LinkedTracker>){emit('update:modelValue',props.modelValue.map((r,i)=>i===index?{...r,...patch}:r))}
</script>
<template>
 <details class="sheet-details" :open="!!modelValue.length">
  <summary>Linked trackers <span v-if="modelValue.length">({{modelValue.length}})</span></summary>
  <p class="sheet-small">Characters receive these trackers with the item. Names, added trackers and removed trackers follow reviewed item updates. Each inventory entry has its own pool; quantity does not multiply uses.</p>
  <fieldset v-for="(tracker,index) in modelValue" :key="tracker.id" class="sheet-form-grid">
   <legend>Tracker {{index+1}}</legend>
   <label>Tracker name<input :value="tracker.name" required maxlength="200" @input="change(index,{name:($event.target as HTMLInputElement).value})" /></label>
   <label>Total uses<input :value="tracker.max" type="number" required min="1" max="999" step="1" @input="change(index,{max:Number(($event.target as HTMLInputElement).value)})" /></label>
   <label>Recovers on<select :value="tracker.recovery" @change="change(index,{recovery:($event.target as HTMLSelectElement).value as LinkedTracker['recovery']})"><option value="long">Long rest</option><option value="short">Short or long rest</option><option value="manual">Manual recovery</option></select></label>
   <label>Available<select :value="tracker.activation" @change="change(index,{activation:($event.target as HTMLSelectElement).value as LinkedTracker['activation']})"><option value="carried">While carried</option><option value="equipped">While equipped (and attuned if required)</option><option value="attuned">While attuned</option></select></label>
   <label>Tracker notes<textarea :value="tracker.notes" rows="2" maxlength="10000" @input="change(index,{notes:($event.target as HTMLTextAreaElement).value})" /></label>
   <p v-if="tracker.activation==='attuned'" class="sheet-small">Enable Requires attunement on the item. The tracker appears when the character attunes to it.</p>
   <button type="button" class="sheet-button sheet-small-button" @click="emit('update:modelValue',modelValue.filter((_,i)=>i!==index))">Remove tracker</button>
  </fieldset>
  <p class="sheet-small">Unequipping or ending attunement hides applicable trackers without refilling them. Removing the item removes its trackers.</p>
  <p v-if="issue" class="sheet-alert" role="alert">{{issue}}</p>
  <button type="button" class="sheet-button sheet-small-button" :disabled="modelValue.length>=20" @click="emit('update:modelValue',[...modelValue,newLinkedTracker()])">+ Add tracker</button>
 </details>
</template>
