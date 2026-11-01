import {beforeEach,expect,it,vi} from 'vitest'
import {createSSRApp,reactive,ref,type Component} from 'vue'
import {renderToString} from 'vue/server-renderer'
import {emptyCharacter} from '../../../shared/character'
import {armourValues} from '../../lib/equipment'
import EquipmentSpellsTab from './EquipmentSpellsTab.vue'
const state=vi.hoisted(()=>({store:undefined as any}))
vi.mock('../../stores/characters',()=>({useCharactersStore:()=>state.store}))
vi.mock('../../composables/useSheetLibrary',()=>({useSheetLibrary:()=>({items:ref({})})}))
vi.mock('../items/DeferredItemComposer.vue',()=>({default:{render:()=>null}}))
vi.mock('./ItemRules.vue',()=>({default:{render:()=>null}}))
vi.mock('../../lib/equipment',async importOriginal=>{
 const actual=await importOriginal<typeof import('../../lib/equipment')>()
 return {...actual,armourValues:vi.fn(actual.armourValues)}
})
beforeEach(()=>{
 const current={...emptyCharacter(),_id:'fixture',updatedAt:'2026-11-01'}
 current.abilities.dex=14;current.combat.acMode='equipment'
 current.equipment=[{name:'Leather',qty:1,weight:10,equipped:true,notes:'',armor:{base:11,dex:true,shield:false}},
  {name:'Rope',qty:1,weight:1,equipped:false,notes:''}]
 state.store=reactive({current,saving:false,canEditPermanent:false})
 vi.mocked(armourValues).mockClear()
})
function render(query:string,capture?:(bindings:any)=>void){
 const original=EquipmentSpellsTab as any
 const subject={...original,setup(props:unknown,context:unknown){
  const bindings=original.setup(props,context)
  bindings.query.value=query
  capture?.(bindings)
  return bindings
 }}
 return renderToString(createSSRApp(subject as Component))
}
it('does no armour-preview work for filtered-out armour rows',async()=>{
 const html=await render('Rope')
 expect(html).toContain('Rope');expect(html).not.toContain('Leather')
 expect(armourValues).not.toHaveBeenCalled()
})
it('renders current AC when armour becomes visible and after ability changes',async()=>{
 let row:any
 let html=await render('Leather',bindings=>{row=bindings.items.value[0]})
 expect(html).toContain('Worn gear AC</small><strong>13</strong>')
 expect(armourValues).toHaveBeenCalled()
 expect(row.armour.total).toBe(13)
 state.store.current.abilities.dex=18
 expect(row.armour.total).toBe(15)
 state.store.current.features=[{name:'Ward',description:'',origin:'feat'}]
 state.store.current.compendiumRules=[{kind:'feats',index:'ward',revision:1,before:{name:'Ward'},entry:{name:'Ward',benefits:[{type:'ac-bonus',value:2}]}}]
 expect(row.armour.total).toBe(17)
 html=await render('Leather')
 expect(html).toContain('Worn gear AC</small><strong>17</strong>')
})
