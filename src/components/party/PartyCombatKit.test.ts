import {beforeEach,expect,it,vi} from 'vitest'
import {createSSRApp,reactive,type Component} from 'vue'
import {renderToString} from 'vue/server-renderer'
import {emptyCharacter} from '../../../shared/character'
import type {SrdSpell} from '../../lib/srd'
import PartyCombatKit from './PartyCombatKit.vue'
const api=vi.hoisted(()=>({get:vi.fn()}))
vi.mock('../../lib/api',()=>({api}))
const spell=(index:string,extra:Partial<SrdSpell>={}):SrdSpell=>({index,name:index,url:'',level:1,school:{index:'evocation',name:'Evocation',url:''},casting_time:'1 action',range:'120 feet',duration:'Instantaneous',components:['V','S'],concentration:false,ritual:false,desc:['Full spell rules.'],classes:[{index:'wizard',name:'Wizard',url:''}],...extra})
function fixture(){
 const c=reactive({...emptyCharacter(),_id:'hero',updatedAt:'now'});c.meta.level=6;c.abilities.cha=18;c.abilities.int=12;c.spellcasting.ability='cha';c.spellcasting.known=['Bolt','Flame','Utility','Missing'];c.spellcasting.prepared=['Flame']
 c.equipment=[{name:'Focus',qty:1,weight:0,equipped:true,notes:'',benefits:[{type:'spell-attack-bonus',value:3},{type:'spell-dc-bonus',value:3}]}]
 return {character:c,spells:{Bolt:spell('Bolt',{attack_type:'ranged',higher_level:['More damage at higher levels.']}),Flame:spell('Flame',{dc:{dc_type:{index:'dex'}}}),Utility:spell('Utility')},libraryRevision:'fixture'}
}
beforeEach(()=>api.get.mockReset())
async function render(data:ReturnType<typeof fixture>){
 api.get.mockResolvedValue(data)
 let bindings:any
 const original=PartyCombatKit as any
 const component={...original,setup(props:unknown,context:unknown){bindings=original.setup(props,context);bindings.character.value=data.character;bindings.spells.value=data.spells;return bindings}} as Component
 const html=await renderToString(createSSRApp(component,{roomId:'room',characterId:'hero',version:'now'}))
 return {html:html.replace(/ data-v-[\w-]+(?:="[^"]*")?/g,''),bindings}
}
it('reuses spellbook rows with current attack/save totals, full casting details and prepared ordering',async()=>{
 const data=fixture(),saved=JSON.stringify(data.character),{html}=await render(data)
 expect(html).toContain('Spellbook');expect(html).toContain('CHA');expect(html).toContain('1d20 +10');expect(html).toContain('DEX save DC 18');expect(html).toContain('No attack or save');expect(html).toContain('Rules unavailable')
 expect(html).toContain('<strong>Casting time:</strong>');expect(html).toContain('<strong>Range:</strong>');expect(html).toContain('More damage at higher levels.');expect(html.indexOf('<strong>Flame</strong>')).toBeLessThan(html.indexOf('<strong>Bolt</strong>'))
 expect(html).toContain('Full spellbook');expect(html).toContain('Prepared · Read-only combat reference.');expect(JSON.stringify(data.character)).toBe(saved);expect(api.get).toHaveBeenCalledTimes(1)
})
it('updates profiles for nested item/ability changes and keeps the existing spell search',async()=>{
 const data=fixture(),{bindings:b}=await render(data),bolt=()=>b.spellList.value.find((s:any)=>s.index==='Bolt').profile
 expect(bolt().attack).toBe(10);data.character.equipment[0]!.equipped=false;expect(bolt().attack).toBe(7);data.character.abilities.cha=20;expect(bolt().attack).toBe(8)
 b.query.value='Flame';expect(b.spellList.value.map((s:any)=>s.index)).toEqual(['Flame']);expect(api.get).toHaveBeenCalledTimes(1)
})
