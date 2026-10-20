<script setup lang="ts">
import { computed, ref, useId } from 'vue'
import { useBuilderAppearance } from '../../composables/useBuilderAppearance'
import { useCharactersStore } from '../../stores/characters'
import CharacterHeader from './CharacterHeader.vue'
import CharacterSidebar from './CharacterSidebar.vue'
import HitPointsPanel from './HitPointsPanel.vue'
import CombatTrackers from './CombatTrackers.vue'
import { vMotionPanel } from '../../directives/siteMotion'
const props=defineProps<{active:string;tabs:{key:string;label:string}[];compactSummary?:boolean}>()
defineEmits<{select:[key:string];edit:[]}>()
const {appearance}=useBuilderAppearance(),store=useCharactersStore()
const folio=computed(()=>appearance.sheetLayout==='folio')
const hasRail=computed(()=>folio.value&&!['combat','edit'].includes(props.active))
const railOpen=ref(false),railId=useId()
</script>
<template>
  <div class="sheet-workspace" :class="{'sheet-workspace-compact':compactSummary,'sheet-folio-workspace':folio}">
    <CharacterSidebar v-if="!folio&&!compactSummary" @edit="$emit('edit')" />
    <main class="sheet-main">
      <CharacterHeader v-if="folio" />
      <nav class="sheet-navigation" aria-label="Character sections"><button v-for="tab in tabs" :key="tab.key" type="button" :data-preview-tab="tab.key" :aria-current="active===tab.key?'page':undefined" :class="{active:active===tab.key}" @click="$emit('select',tab.key)">{{tab.label}}</button></nav>
      <slot name="status" />
      <div class="sheet-tab-layout" :class="{'sheet-tab-with-rail':hasRail}">
        <div v-motion-panel="active" class="sheet-tab-content"><slot /></div>
        <aside v-if="hasRail" class="sheet-resource-rail" :data-open="railOpen" aria-label="Hit points and resources">
          <button type="button" class="sheet-button sheet-rail-toggle" data-sheet-rail-toggle :aria-expanded="railOpen" :aria-controls="railId" @click="railOpen=!railOpen">HP & resources <span>{{store.current!.combat.hpCurrent}} / {{store.current!.combat.hpMax}} HP {{railOpen?'▴':'▾'}}</span></button>
          <div :id="railId" class="sheet-rail-content"><HitPointsPanel compact /><CombatTrackers variant="rail" /></div>
        </aside>
      </div>
      <slot name="footer" />
    </main>
  </div>
</template>
