import {beforeEach,expect,it,vi} from 'vitest'
import {createSSRApp,reactive,ref,type Component} from 'vue'
import {renderToString} from 'vue/server-renderer'
import {emptyCharacter} from '../../../shared/character'
import SpellbookPanel from './SpellbookPanel.vue'
import type {SrdSpell} from '../../lib/srd'
const state=vi.hoisted(()=>({store:undefined as any,spells:undefined as any}))
vi.mock('../../stores/characters',()=>({useCharactersStore:()=>state.store}))
vi.mock('../../composables/useSheetLibrary',()=>({useSheetLibrary:()=>({spells:state.spells,loading:ref(false)})}))
vi.mock('../../composables/useBuilderAppearance',()=>({useBuilderAppearance:()=>({appearance:{sheetLayout:'standard'}})}))
const spell=(index:string,name:string,extra:Partial<SrdSpell>={}):SrdSpell=>({index,name,url:'',level:0,school:{index:'evocation',name:'Evocation',url:''},casting_time:'1 action',range:'120 feet',duration:'Instantaneous',components:['V','S'],concentration:false,ritual:false,desc:['Full spell rules.'],classes:[],...extra})
beforeEach(()=>{
 const c={...emptyCharacter(),_id:'hero',updatedAt:'2026-11-10'};c.meta.level=6;c.meta.klass='Wizard';c.abilities.cha=18;c.abilities.int=12;c.spellcasting.ability='cha';c.spellcasting.known=['bolt','flame','utility','unknown'];c.spellcasting.prepared=['flame']
 c.features=[{name:'Arcane gift',description:'',origin:'feat'}];c.compendiumRules=[{kind:'feats',index:'gift',revision:1,before:{name:'Arcane gift'},entry:{name:'Arcane gift',benefits:[{type:'spell',value:{key:'bolt',ability:'int'}},{type:'spell-attack-bonus',value:1},{type:'spell-dc-bonus',value:1}]}}]
 state.store=reactive({current:c,saving:false,canEditPermanent:true,update:vi.fn().mockResolvedValue(undefined)})
 state.spells=ref({bolt:spell('bolt','Arcane Bolt',{attack_type:'ranged',higher_level:['More beams at higher levels.']}),flame:spell('flame','Flame Cone',{level:1,dc:{dc_type:{index:'dex'}}}),utility:spell('utility','Utility Light')})
})
async function render(capture?:(bindings:any)=>void){const original=SpellbookPanel as any;return renderToString(createSSRApp({...original,setup(p:unknown,c:unknown){const b=original.setup(p,c);capture?.(b);return b}} as Component)).then(html=>html.replace(/ data-v-[\w-]+(?:="[^\"]*")?/g,''))}
it('renders B rows with source-specific numbers, bold casting labels and complete granted spell rules',async()=>{
 const html=await render(b=>b.showAll.value=true);expect(html).toContain('Granted spells');expect(html).toContain('Arcane gift');expect(html).toContain('1d20 +5');expect(html).toContain('1d20 +8');expect(html).toContain('DEX save DC 16');expect(html).toContain('No attack or save');expect(html).toContain('<strong>Casting time:</strong>');expect(html).toContain('<strong>Range:</strong>');expect(html).toContain('More beams at higher levels.');expect(html).toContain('Rules unavailable');expect(html).toContain('aria-pressed="true"')
})
it('reacts to nested ability, active item and approved benefit changes without stale per-spell totals',async()=>{
 let b:any;await render(v=>b=v);const ordinary=()=>b.groups.value.flatMap((g:any)=>g.spells).find((s:any)=>s.index==='bolt').profile
 expect(ordinary().attack).toBe(8);expect(b.innate.value[0].profile.attack).toBe(5);state.store.current.abilities.int=18;expect(b.innate.value[0].profile.attack).toBe(8)
 state.store.current.equipment=[{name:'Focus',qty:1,weight:1,notes:'',equipped:true,benefits:[{type:'spell-attack-bonus',value:3}]}];expect(ordinary().attack).toBe(11);state.store.current.equipment[0].equipped=false;expect(ordinary().attack).toBe(8)
 state.store.current.compendiumRules[0].entry.benefits=[];expect(b.innate.value).toEqual([]);expect(ordinary().attack).toBe(7)
})
it('keeps prepare/search filters and save guards without spending slots or mutating known spells',async()=>{
 let b:any;await render(v=>b=v);b.query.value='Flame';expect(b.groups.value.flatMap((g:any)=>g.spells).map((s:any)=>s.index)).toEqual(['flame']);const before=JSON.stringify(state.store.current)
 await b.prepare('flame');expect(state.store.update).toHaveBeenCalledExactlyOnceWith('hero',{spellcasting:{...state.store.current.spellcasting,prepared:[]}});expect(JSON.stringify(state.store.current)).toBe(before)
 state.store.saving=true;await b.prepare('flame');expect(state.store.update).toHaveBeenCalledTimes(1)
})

it('shows newly learned level-four spells by default without preparing or saving them',async()=>{
 const c=state.store.current;c.meta.level=7;c.spellcasting.known.push('wall-of-fire','elemental-bane')
 state.spells.value['wall-of-fire']=spell('wall-of-fire','Wall of Fire',{level:4})
 state.spells.value['elemental-bane']=spell('elemental-bane','Elemental Bane',{level:4})
 const before=JSON.stringify(c)
 let b:any;const html=await render(v=>b=v)
 expect(html).toContain('Wall of Fire');expect(html).toContain('Elemental Bane');expect(html).toContain('Level 4')
 const newSpells=()=>b.groups.value.flatMap((g:any)=>g.spells).filter((s:any)=>s.level===4)
 expect(newSpells()).toHaveLength(2);expect(newSpells().every((s:any)=>!s.ready)).toBe(true)
 expect(state.store.update).not.toHaveBeenCalled();expect(JSON.stringify(c)).toBe(before)
 b.showAll.value=false;expect(newSpells()).toHaveLength(0)
 b.showAll.value=true;expect(newSpells()).toHaveLength(2)
})
