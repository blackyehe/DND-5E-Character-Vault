import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {createSSRApp,ref} from 'vue'
import {renderToString} from 'vue/server-renderer'
import {createPinia,disposePinia,type Pinia} from 'pinia'
import {useCharactersStore} from '../../stores/characters'
import {emptyCharacter} from '../../../shared/character'
import CombatTrackers from './CombatTrackers.vue'
import ItemRules from './ItemRules.vue'

vi.mock('../../composables/useSheetLibrary',()=>({useSheetLibrary:()=>({features:ref([]),featCatalog:ref([])})}))
let pinia:Pinia
beforeEach(()=>{pinia=createPinia()})
afterEach(()=>{disposePinia(pinia)})

it('updates combat and rail indicators when equipping, attuning and unequipping an item in player preview',async()=>{
 const store=useCharactersStore(pinia),c={...emptyCharacter(),_id:'preview',updatedAt:'2026-11-09T00:00:00.000Z'}
 c.meta.level=9;c.abilities.int=18;c.spellcasting.known=['fire-bolt']
 c.equipment=[{name:'Test focus',kind:'accessory',magical:true,qty:1,weight:1,notes:'',equipped:false,requiresAttunement:true,attuned:false,benefits:[{type:'spell-attack-bonus',value:3},{type:'spell-dc-bonus',value:3}]}]
 store.current=c;store.roomContext={roomId:'room',role:'player',preview:true}
 const check=async(attack:number,dc:number)=>{
  for(const variant of [undefined,'rail'] as const){
   const html=(await renderToString(createSSRApp(CombatTrackers,{variant}).use(pinia))).replace(/ data-v-[\w-]+(?:="[^"]*")?/g,'')
   expect(html).toContain(`Spell attack</dt><dd>+${attack}</dd>`)
   expect(html).toContain(`Save DC</dt><dd>${dc}</dd>`)
  }
 }
 await check(8,16)
 const equip=async(equipped:boolean,attuned:boolean)=>store.update(c._id,{equipment:[{...store.current!.equipment[0]!,equipped,attuned}]})
 await equip(true,false);await check(8,16)
 await equip(true,true);await check(11,19)
 await equip(false,true);await check(8,16)
 const rules=await renderToString(createSSRApp(ItemRules,{item:store.current!.equipment[0]!}))
 expect(rules).toContain('Spell attack bonus: 3');expect(rules).toContain('Spell save DC bonus: 3')
 expect(rules).toContain('Benefits while equipped and attuned')
})

it('groups rail slots without losing mixed recovery rules or resource notes',async()=>{
 const store=useCharactersStore(pinia),c={...emptyCharacter(),_id:'preview',updatedAt:'2026-11-11'}
 c.meta.klass='Wizard';c.meta.level=7;c.spellcasting.known=['wall-of-fire'];delete c.spellcasting.slotRule
 c.spellcasting.slots={l1:{max:4,used:1,recovery:'long'},l4:{max:1,used:0,recovery:'short'}}
 c.resources=[{id:'custom',name:'A long resource name',max:2,used:1,recovery:'manual',notes:'Keep this explanation.'}]
 store.current=c
 const rail=(await renderToString(createSSRApp(CombatTrackers,{variant:'rail'}).use(pinia))).replace(/ data-v-[\w-]+(?:="[^"]*")?/g,'')
 expect(rail.match(/class="sheet-slot-group|sheet-tracker-card sheet-slot-group/g)).toHaveLength(1)
 expect(rail).toContain('Use level 4 slot');expect(rail).toContain('Restore level 1 slot')
 expect(rail).toContain('Short rest</small>');expect(rail).toContain('Long rest</small>')
 expect(rail).not.toContain('All slots recover on a');expect(rail).toContain('Keep this explanation.');expect(rail).toContain('Manual recovery')
 const regular=await renderToString(createSSRApp(CombatTrackers).use(pinia))
 expect(regular).not.toContain('sheet-slot-group');expect(regular).toContain('Level 4 slots')
 c.spellcasting.slots.l4!.recovery='long';store.current={...c}
 const shared=await renderToString(createSSRApp(CombatTrackers,{variant:'rail'}).use(pinia))
 expect(shared).toContain('All slots recover on a long rest.')
})
