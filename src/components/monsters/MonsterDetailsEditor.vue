<script setup lang="ts">
import type { MonsterDraft, MonsterStep } from '../../../shared/monster-workshop'
import { MONSTER_ABILITIES } from '../../../shared/monster-statblock'
const props=defineProps<{monster:MonsterDraft;step:MonsterStep}>()
props.monster.extended??={}
const e=props.monster.extended
e.sourceInfo??={id:'',edition:'',page:'',url:''}
e.provenance??={format:'',original:'',notes:''}
e.info??={text:'',source:'',images:[]}
e.aliases??=[];e.sizes??=[];e.unknown??=[];e.armorAlternatives??=[]
function number(event:Event,key:'initiative'|'initiativeScore'|'lairXp'){const value=(event.target as HTMLInputElement).value;e[key]=value===''?null:Number(value)}
function aliases(event:Event){e.aliases=(event.target as HTMLInputElement).value.split(',').map(s=>s.trim()).filter(Boolean)}
</script>
<template>
  <template v-if="step==='identity'">
  <details>
    <summary>Source, versions &amp; search names</summary>
    <div class="mw-fields">
      <label>Source ID / acronym<input v-model="e.sourceInfo!.id" maxlength="250" placeholder="MTF, XMM, or your source ID"></label>
      <label>Rules edition<input v-model="e.sourceInfo!.edition" maxlength="250" placeholder="2014 or 2024"></label>
      <label>Source page<input v-model="e.sourceInfo!.page" maxlength="250"></label>
      <label>Source URL<input v-model="e.sourceInfo!.url" maxlength="2000" type="url"></label>
      <label>Browse family<input v-model="e.family" maxlength="250" placeholder="Blank uses the creature name"></label>
      <label>Form / version label<input v-model="e.variant" maxlength="250" placeholder="Spellcaster, bat form, etc."></label>
      <label class="mw-full">Search aliases (comma separated)<input :value="e.aliases!.join(', ')" maxlength="20000" @change="aliases"></label>
    </div>
    <p class="hw-hint">A browse family shares one listing. Each creature keeps its own rules and source version.</p>
    <p>Additional size choices</p><div class="mw-checks"><label v-for="size in ['Tiny','Small','Medium','Large','Huge','Gargantuan']" :key="size" class="mw-check"><input v-model="e.sizes" type="checkbox" :value="size">{{size}}</label></div>
    <p class="hw-hint">Leave all unchecked to use the primary size.</p>
    <div class="mw-fields"><label>Habitat<input v-model="e.habitat" maxlength="2000"></label><label>Treasure<input v-model="e.treasure" maxlength="2000"></label></div>
  </details>
  <details>
    <summary>Info: lore &amp; artwork</summary>
    <label>Lore / background<textarea v-model="e.info!.text" rows="8" maxlength="100000" placeholder="Background, ecology, appearance, and named lore sections"></textarea></label>
    <label>Lore source / attribution<input v-model="e.info!.source" maxlength="2000" placeholder="Source book, page, and creature name / source ID"></label>
    <p class="hw-hint">Lore is separate from combat rules. Artwork is kept as a link with its credit; it is not downloaded automatically.</p>
    <div v-for="(image,i) in e.info!.images" :key="i" class="mw-fields">
      <label class="mw-full">Artwork URL<input v-model="image.url" type="url" maxlength="2000" placeholder="https://..."></label>
      <label>Artwork title<input v-model="image.title" maxlength="250"></label>
      <label>Artist / credit<input v-model="image.credit" maxlength="2000"></label>
      <button class="hw-text-button" @click="e.info!.images.splice(i,1)">Remove artwork {{i+1}}</button>
    </div>
    <button class="hw-button" :disabled="e.info!.images.length>=20" @click="e.info!.images.push({url:'',title:'',credit:''})">+ Artwork reference</button>
  </details>
  </template>
  <details v-else-if="step==='statistics'">
    <summary>Initiative, lair XP &amp; formula hit points</summary>
    <div class="mw-fields">
      <label>Printed initiative bonus<input :value="e.initiative??''" type="number" min="-100" max="100" @input="number($event,'initiative')"></label>
      <label>Printed initiative score<input :value="e.initiativeScore??''" type="number" min="-100" max="100" @input="number($event,'initiativeScore')"></label>
      <label>Lair XP<input :value="e.lairXp??''" type="number" min="0" max="1000000000" @input="number($event,'lairXp')"></label>
      <label>XP conditions<input v-model="e.xpNote" maxlength="2000"></label>
      <label class="mw-full">Special / formula HP<input v-model="e.hpText" maxlength="2000" placeholder="40 + 10 for each spell level above 4th"></label>
    </div><p class="hw-hint">Special HP replaces the numeric HP and dice. Printed initiative values are independent of ability calculations.</p>
  </details>
  <details v-else-if="step==='defenses'">
    <summary>Formula &amp; alternative armor classes</summary>
    <label>Special / formula AC<input v-model="e.armorText" maxlength="2000" placeholder="11 + the spell's level"></label>
    <div v-for="(ac,i) in e.armorAlternatives" :key="i" class="mw-fields"><label>Alternative AC<input v-model.number="ac.value" type="number" min="0" max="100" @change="ac.value=typeof ac.value==='number'?ac.value:null"></label><label>Condition / description<input v-model="ac.note" maxlength="2000"></label><button class="hw-text-button" @click="e.armorAlternatives!.splice(i,1)">Remove alternative {{i+1}}</button></div>
    <button class="hw-button" :disabled="e.armorAlternatives!.length>=20" @click="e.armorAlternatives!.push({value:null,note:''})">+ Alternative AC</button>
  </details>
  <details v-else-if="step==='advanced'">
    <summary>Unknown statistics &amp; retained source material</summary>
    <p class="hw-hint">Mark a statistic unknown when the source omits it. The saved statblock will show it as unrecorded. Use written rules for effects whose calculations depend on unknown values.</p>
    <div class="mw-checks"><label v-for="key in (['armor','hp','speed','cr',...MONSTER_ABILITIES] as const)" :key="key" class="mw-check"><input v-model="e.unknown" type="checkbox" :value="key">{{({armor:'Armor Class',hp:'Hit Points',speed:'Speed',cr:'Challenge rating'} as Record<string,string>)[key]??key.toUpperCase()}} unknown</label></div>
    <label>Original format<input v-model="e.provenance!.format" maxlength="250" placeholder="Copied text, 5etools JSON, etc."></label>
    <label>Original source material<textarea v-model="e.provenance!.original" rows="6" maxlength="500000"></textarea></label>
    <label>Unmapped fields / review notes<textarea v-model="e.provenance!.notes" rows="4" maxlength="20000"></textarea></label>
    <p class="hw-hint">Retained for review and account backup. Original material does not automatically populate the creature or resolve spell references.</p>
  </details>
</template>
