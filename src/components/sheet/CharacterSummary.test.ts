import {beforeEach,expect,it,vi} from 'vitest'
import {createSSRApp,reactive,type Component} from 'vue'
import {renderToString} from 'vue/server-renderer'
import {emptyCharacter} from '../../../shared/character'
import CharacterSummary from './CharacterSummary.vue'
const state=vi.hoisted(()=>({store:undefined as any}))
vi.mock('../../stores/characters',()=>({useCharactersStore:()=>state.store}))
vi.mock('./SheetVitalsStats.vue',()=>({default:{render:()=>null}}))
vi.mock('./SheetDisclosure.vue',()=>({default:{render:()=>null}}))
beforeEach(()=>{
 const c={...emptyCharacter(),_id:'hero',updatedAt:'2026-11-09T12:00:00.000Z'};c.meta.level=6;c.abilities.int=20;c.spellcasting.ability='int';c.spellcasting.known=['light'];c.spellcasting.slots={l1:{max:4,used:3}}
 c.features=[{name:'Contractor',description:'',origin:'feat' as const}];c.compendiumRules=[{kind:'feats' as const,index:'feat',revision:1,before:{name:'Contractor'},entry:{name:'Contractor',benefits:[{type:'spell-attack-bonus',value:1},{type:'spell-dc-bonus',value:1},{type:'saving-throw-prof',value:'cha'},{type:'saving-throw-bonus',value:1}]}}]
 c.equipment=[{name:'Dagger',kind:'weapon' as const,equipped:true,qty:1,weight:1,notes:'',weapon:{dice:'1d4',damageType:'piercing',range:'Melee',finesse:false,ranged:false,category:'simple'}}]
 state.store=reactive({current:c,canEditPermanent:false,saving:false,update:vi.fn().mockResolvedValue(undefined)})
})
function render(capture?:(bindings:any)=>void){const original=CharacterSummary as any;return renderToString(createSSRApp({...original,setup(p:unknown,c:unknown){const bindings=original.setup(p,c);capture?.(bindings);return bindings}} as Component)).then(html=>html.replace(/ data-v-[\w-]+(?:="[^"]*")?/g,''))}
it('shows player rest controls, all six effective saves, equipped attacks and current spell totals above training',async()=>{
 let bindings:any;const html=await render(b=>bindings=b);expect(html).toContain('Long rest</button>');expect(html).toContain('HP and hit dice are managed separately.');expect(bindings.saves.value).toHaveLength(6);expect(bindings.saves.value.find((s:any)=>s.key==='cha')).toMatchObject({modifier:4,proficient:true})
 expect(html).toContain('Spell attack</dt><dd>+9</dd>');expect(html).toContain('Spell save DC</dt><dd>17</dd>');expect(html).toContain('Dagger');expect(html).toContain('1d4 piercing');expect(html.indexOf('Saving throws')).toBeGreaterThan(html.indexOf('Skills &amp; proficiencies'));expect(html.indexOf('Combat at a glance')).toBeLessThan(html.indexOf('Training &amp; languages'))
 state.store.current.equipment[0].equipped=false;expect(bindings.attacks.value).toEqual([]);state.store.current.compendiumRules[0].entry.benefits=[];expect(bindings.saves.value.find((s:any)=>s.key==='cha').modifier).toBe(0)
})
it('saves a rest once with the character version and reports success without changing saved data optimistically',async()=>{
 let bindings:any;await render(b=>bindings=b);const before=JSON.stringify(state.store.current);let resolve!:()=>void;state.store.update.mockReturnValueOnce(new Promise<void>(r=>resolve=r));const pending=bindings.longRest();await bindings.longRest();expect(state.store.update).toHaveBeenCalledTimes(1);expect(state.store.update.mock.calls[0]).toMatchObject(['hero',{spellcasting:{slots:{l1:{max:4,used:0}}}},{expectedUpdatedAt:'2026-11-09T12:00:00.000Z'}]);expect(JSON.stringify(state.store.current)).toBe(before);resolve();await pending;expect(bindings.restMessage.value).toMatch(/Long rest applied/)
})
it('blocks a rest during saving and leaves failed rests available for retry',async()=>{
 let bindings:any;await render(b=>bindings=b);state.store.saving=true;await bindings.longRest();expect(state.store.update).not.toHaveBeenCalled();state.store.saving=false;state.store.update.mockRejectedValueOnce(Error('Conflict'));await bindings.longRest();expect(bindings.restMessage.value).toBe('');expect(bindings.resting.value).toBe(false);expect(state.store.current.spellcasting.slots.l1.used).toBe(3);await bindings.longRest();expect(bindings.restMessage.value).toMatch(/Long rest applied/)
})
it('uses actual proficiency/expertise for backgrounds and spells out saving throw names',async()=>{
 state.store.current.skills={arcana:'expert',stealth:'prof'}
 const html=await render()
 expect(html).toMatch(/<li data-rank="expert"><div><span>Arcana<\/span>/)
 expect(html).toMatch(/<li data-rank="prof"><div><span>Stealth<\/span>/)
 expect(html).toMatch(/<li data-rank="none"><div><span>Acrobatics<\/span>/)
 expect(html).toContain('data-rank="prof"><dt>Charisma</dt>')
 expect(html).toContain('data-rank="none"><dt>Strength</dt>')
 state.store.current.compendiumRules[0].entry.benefits=[]
 expect(await render()).toContain('data-rank="none"><dt>Charisma</dt>')
})
