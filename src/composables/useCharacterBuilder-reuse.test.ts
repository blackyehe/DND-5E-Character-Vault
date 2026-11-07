import {expect,it,vi} from 'vitest'
import {createSSRApp,h} from 'vue'
import {renderToString} from '@vue/server-renderer'
import {useCharacterBuilder} from './useCharacterBuilder'
import {selectedFeatIndexes} from '../lib/advancements'
import {slotMaximums} from '../../shared/character-progression'
import {newWorkshopDraft} from '../../shared/homebrew-workshop'
vi.mock('../stores/auth',()=>({useAuthStore:()=>({user:{id:'isolated-fixture'}})}))
vi.mock('../lib/advancements',async importOriginal=>{
 const actual=await importOriginal<typeof import('../lib/advancements')>()
 return {...actual,selectedFeatIndexes:vi.fn(actual.selectedFeatIndexes)}
})
async function builder(){
 let result:ReturnType<typeof useCharacterBuilder>|undefined
 await renderToString(createSSRApp({setup(){result=useCharacterBuilder();return ()=>h('div')}}))
 return result!
}
it('preserves selected imported feat identities, descriptions and unlock levels in a large catalogue',async()=>{
 const b=await builder()
 b.klass.value={index:'wizard',name:'Wizard',url:'',hit_die:6,saving_throws:[],proficiencies:[],starting_equipment:[],multi_classing:{},subclasses:[]}
 b.klass.value.workshop=newWorkshopDraft('class');b.klass.value.workshop.magic.enabled=true
 b.draft.klass='wizard';b.draft.level=8
 b.draft.advancements={'class-4':{kind:'feat',feat:'feat-1700',increases:{}},'class-8':{kind:'feat',feat:'feat-20',increases:{}}}
 b.feats.value=Array.from({length:2000},(_,i)=>({index:`feat-${i}`,name:`Feat ${i}`,url:'',description:`Full rules ${i}`,prerequisites:[],ability_increases:[],homebrew:true,sourcePack:'Fixture'}))
 vi.mocked(selectedFeatIndexes).mockClear()
 expect(b.context.value.features.filter(f=>f.origin==='feat').map(f=>({id:f.definition?.index,description:f.description,level:f.level}))).toEqual([
  {id:'feat-20',description:'Full rules 20',level:8},{id:'feat-1700',description:'Full rules 1700',level:4},
 ])
 expect(selectedFeatIndexes).toHaveBeenCalledTimes(1)
 expect(b.context.value.slots).toEqual(slotMaximums('full',8))
 b.draft.level=4
 expect(b.context.value.features.filter(f=>f.origin==='feat').map(f=>f.definition?.index)).toEqual(['feat-1700'])
 expect(b.context.value.slots).toEqual(slotMaximums('full',4))
})
it('retains manual feat overrides and leaves unknown-class spell slots empty',async()=>{
 const b=await builder();b.draft.klass='custom';b.draft.featLimitOverride=true;b.draft.feats=['extra']
 b.feats.value=[{index:'extra',name:'Extra',url:'',description:'Unchanged imported rules',prerequisites:[],ability_increases:[],homebrew:true,sourcePack:'Fixture'}]
 expect(b.context.value.features.filter(f=>f.origin==='feat')).toMatchObject([{name:'Extra',description:'Unchanged imported rules',level:1}])
 expect(Object.values(b.context.value.slots)).toEqual(Array(9).fill(0))
})
