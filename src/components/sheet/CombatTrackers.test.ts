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
