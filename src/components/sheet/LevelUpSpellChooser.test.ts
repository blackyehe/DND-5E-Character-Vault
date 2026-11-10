import {afterEach,expect,it,vi} from 'vitest'
import {createRenderer,createSSRApp,reactive,ssrContextKey,type Component} from 'vue'
import {renderToString} from 'vue/server-renderer'
import type {SrdSpell} from '../../lib/srd'
import type {AdvancementSpell} from '../../lib/advancement-spells'
import LevelUpSpellChooser from './LevelUpSpellChooser.vue'
const option=(index:string,level=1):AdvancementSpell=>({index,name:index,url:'',level})
const detail=(index:string,level=1):SrdSpell=>({...option(index,level),classes:[],school:{index:'evocation',name:'Evocation',url:''},casting_time:'1 action',range:'60 feet',duration:'Instantaneous',components:['V'],concentration:false,ritual:false,desc:['Full rules.'],higher_level:['More effect at higher levels.']})
const props=(extra:Record<string,unknown>={})=>({label:'Fixture choices',spells:[option('spell')],selected:[] as string[],remainingSpells:1,remainingCantrips:1,loadDefinition:vi.fn(async(index:string)=>detail(index)),onAdd:vi.fn(),onRemove:vi.fn(),...extra})
async function render(p:ReturnType<typeof props>,capture?:(b:any)=>void){const original=LevelUpSpellChooser as any;return renderToString(createSSRApp({...original,setup(v:unknown,c:unknown){const b=original.setup(v,c);capture?.(b);return b}} as Component,p))}
it('pages through the entire catalog and preserves selections while sorting/searching/filtering',async()=>{
 const spells=Array.from({length:81},(_,i)=>({...option(`spell-${String(i).padStart(2,'0')}`,i%4),sourcePack:i%2?'South':'North'})),selected=reactive(['spell-80']),p=props({spells,selected});let b:any
 const html=await render(p,v=>b=v);expect(html).toContain('of 81 matching spells');expect(b.visible.value).toHaveLength(20);expect(b.pages.value).toBe(5);b.page.value=5;expect(b.visible.value).toHaveLength(1)
 b.order.value='name';b.page.value=5;expect(b.visible.value[0].index).toBe('spell-80');b.query.value='spell-80';expect(b.visible.value[0].index).toBe('spell-80');b.level.value='1';expect(b.matches.value).toEqual([]);b.reset();expect(selected).toEqual(['spell-80']);expect(p.loadDefinition).not.toHaveBeenCalled()
})
it('loads and caches each expanded row independently and learns the catalog reference only after its rules arrive',async()=>{
 let resolve!:(s:SrdSpell)=>void;const load=vi.fn(()=>new Promise<SrdSpell>(r=>resolve=r)),p=props({spells:[option('legacy-reference')],loadDefinition:load});let b:any;await render(p,v=>b=v)
 const pending=b.inspect(p.spells[0]);await b.inspect(p.spells[0]);b.add(p.spells[0]);expect(p.onAdd).not.toHaveBeenCalled();expect(load).toHaveBeenCalledExactlyOnceWith('legacy-reference');resolve(detail('canonical-reference'));await pending
 await b.inspect(p.spells[0]);b.add(p.spells[0]);expect(load).toHaveBeenCalledTimes(1);expect(p.onAdd).toHaveBeenCalledExactlyOnceWith(p.spells[0])
})
it('offers per-row retry and refuses stale levels, empty or unavailable definitions',async()=>{
 const load=vi.fn().mockRejectedValueOnce(Error('Network failure')).mockResolvedValueOnce(detail('spell',9)).mockResolvedValueOnce({...detail('spell'),definitionAvailable:false}).mockResolvedValueOnce({...detail('spell'),desc:[]}).mockResolvedValueOnce(detail('spell')),p=props({loadDefinition:load});let b:any;await render(p,v=>b=v)
 for(let i=0;i<4;i++){await b.inspect(p.spells[0]);expect(b.errors.spell).toBeTruthy();b.add(p.spells[0]);expect(p.onAdd).not.toHaveBeenCalled()}
 await b.inspect(p.spells[0]);expect(b.errors.spell).toBeUndefined();b.add(p.spells[0]);expect(p.onAdd).toHaveBeenCalledOnce()
})
it('honours separate cantrip/spell allowances, saving guards and granted-spell mode',async()=>{
 for(const extra of [{remainingSpells:0},{disabled:true},{remainingCantrips:0,spells:[option('spell',0)],loadDefinition:vi.fn(async()=>detail('spell',0))}]){const p=props(extra);let b:any;await render(p,v=>b=v);await b.inspect(p.spells[0]);b.add(p.spells[0]);expect(p.onAdd).not.toHaveBeenCalled()}
 const p=props({granted:true,remainingSpells:0});let b:any;await render(p,v=>b=v);await b.inspect(p.spells[0]);b.add(p.spells[0]);expect(p.onAdd).toHaveBeenCalledOnce()
})
const renderer=createRenderer<object,object>({patchProp(){},insert(){},remove(){},createElement:()=>({}),createText:()=>({}),createComment:()=>({}),setText(){},setElementText(){},parentNode:()=>null,nextSibling:()=>null})
let stop:(()=>void)|undefined
afterEach(()=>{stop?.();stop=undefined})
it('ignores an in-flight response after leaving the chooser',async()=>{
 let resolve!:(s:SrdSpell)=>void,b:any;const p=props({loadDefinition:vi.fn(()=>new Promise<SrdSpell>(r=>resolve=r))}),original=LevelUpSpellChooser as any
 const app=renderer.createApp({...original,setup(v:unknown,c:unknown){b=original.setup(v,c);return b},render:()=>null} as Component,p);app.provide(ssrContextKey,{modules:new Set()});app.mount({});stop=()=>app.unmount()
 const pending=b.inspect(p.spells[0]);app.unmount();stop=undefined;resolve(detail('spell'));await pending;expect(b.definitions.spell).toBeUndefined();expect(p.onAdd).not.toHaveBeenCalled()
})

it('renders casting labels, full rules, scaling and Learn inside the expanded row',async()=>{
 const p=props(),original=LevelUpSpellChooser as any
 const html=await renderToString(createSSRApp({...original,async setup(v:any,c:unknown){const b=original.setup(v,c);await b.inspect(v.spells[0]);b.opened.add(v.spells[0].index);return b}} as Component,p))
 const row=html.slice(html.indexOf('<details'),html.indexOf('</details>'));expect(row).toContain('Casting time:');expect(row).toContain('Full rules.');expect(row).toContain('More effect at higher levels.');expect(row).toContain('Learn spell');expect(row).toContain('open')
})
