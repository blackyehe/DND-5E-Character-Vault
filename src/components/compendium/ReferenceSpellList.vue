<script setup lang="ts">
import {computed,inject,ref,useId,watch} from 'vue'
import {SPELL_REFERENCE_CONTEXT,groupedReadingSpells} from '../../lib/compendium-references'
const props=withDefaults(defineProps<{indexes:string[];inline?:boolean;sourceOnly?:boolean;levels?:Record<string,number>;label?:string}>(),{label:'Spell list'})
const context=inject(SPELL_REFERENCE_CONTEXT,undefined)
const groups=computed(()=>groupedReadingSpells(props.indexes,context?.names.value??new Map(),props.levels))
const rows=computed(()=>groups.value.flatMap(group=>group.spells))
const selectedLevel=ref<number|null>(null)
const activeGroup=computed(()=>groups.value.find(group=>group.level===selectedLevel.value)??groups.value[0])
const panelId=useId(),headingId=useId()
const levelLabel=(level:number)=>level===-1?'Level unavailable':level===0?'Cantrips':`Level ${level}`
watch(()=>props.indexes,()=>{selectedLevel.value=null;void context?.ensure()},{immediate:true})
watch(groups,available=>{if(selectedLevel.value!==null&&!available.some(group=>group.level===selectedLevel.value))selectedLevel.value=null})
</script>
<template>
 <ul v-if="inline" class="reference-spell-list reference-inline-spells">
  <li v-for="(row,n) in rows" :key="row.index+':'+n">
   <span>{{row.name}}</span>
   <small v-if="row.spell">{{row.spell.source}}{{sourceOnly||row.spell.level===undefined?'':row.spell.level===0?' · Cantrip':` · Level ${row.spell.level}`}}</small>
   <details v-else class="reference-missing-spell"><summary>Unresolved reference</summary><code>{{row.index}}</code></details>
  </li>
 </ul>
 <details v-else class="reference-spell-disclosure">
  <summary>{{label}} <span>{{indexes.length}} {{indexes.length===1?'spell':'spells'}}</span></summary>
  <div class="reference-spell-level-buttons" role="group" :aria-label="`${label} levels`">
   <button v-for="group in groups" :key="group.level" type="button" :aria-pressed="activeGroup?.level===group.level" :aria-controls="panelId" :data-spell-level="group.level" @click="selectedLevel=group.level">{{levelLabel(group.level)}} <small>{{group.spells.length}}</small></button>
  </div>
  <section v-if="activeGroup" :id="panelId" class="reference-spell-level" :data-spell-level="activeGroup.level" :aria-labelledby="headingId">
   <h4 :id="headingId" aria-live="polite" aria-atomic="true">{{activeGroup.level===-1?'Level unavailable':activeGroup.level===0?'Cantrips':`Spell level ${activeGroup.level}`}} <small>{{activeGroup.spells.length}} {{activeGroup.spells.length===1?'spell':'spells'}}</small></h4>
   <ul class="reference-spell-list"><li v-for="(row,n) in activeGroup.spells" :key="row.index+':'+n"><span>{{row.name}}</span><small v-if="row.spell">{{row.spell.source}}</small><details v-else class="reference-missing-spell"><summary>Unresolved reference</summary><code>{{row.index}}</code></details></li></ul>
  </section>
 </details>
</template>
