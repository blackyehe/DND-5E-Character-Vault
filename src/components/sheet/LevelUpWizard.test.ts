import {beforeEach,expect,it,vi} from 'vitest'
import {createSSRApp,reactive,type Component} from 'vue'
import {renderToString} from 'vue/server-renderer'
import {emptyCharacter} from '../../../shared/character'
import type {AdvancementRules} from '../../../shared/level-up'
import {srd} from '../../lib/srd'
import LevelUpWizard from './LevelUpWizard.vue'
const mocks=vi.hoisted(()=>({store:undefined as any,load:vi.fn()}))
vi.mock('../../stores/characters',()=>({useCharactersStore:()=>mocks.store}))
vi.mock('../../lib/srd',async original=>({...await original<typeof import('../../lib/srd')>(),srd:{spells:vi.fn(),classSpells:vi.fn()}}))
vi.mock('../../lib/level-up-rules',()=>({advancementCatalog:vi.fn(),loadAdvancementRules:mocks.load,preparedLimit:()=>null}))
const rule=():AdvancementRules=>({name:'Wizard',index:'wizard',source:'2014 SRD',classLevel:7,subclassLevel:2,hitDie:6,subclasses:[],features:[],asi:false,warnings:[],casting:{ability:'int',learning:'book',cantrips:1,spells:2,maxSpellLevel:4,slots:{l1:4,l2:3,l3:3,l4:1}}})
const option=(index:string,level=2)=>({index,name:index,url:'',level})
beforeEach(()=>{const c={...emptyCharacter(),_id:'hero',updatedAt:'2026-11-10T12:00:00.000Z'};c.meta.klass='Wizard';c.meta.classIndex='wizard';c.meta.level=6;c.spellcasting.known=['already'];c.combat.hpCurrent=3;c.resources=[{id:'manual',name:'Uses',max:3,used:2,recovery:'long'}];mocks.store=reactive({current:c,saving:false,update:vi.fn()});vi.mocked(srd.spells).mockReset();vi.mocked(srd.classSpells).mockReset();mocks.load.mockReset()})
async function bindings(){let b:any;const original=LevelUpWizard as any;await renderToString(createSSRApp({...original,setup(p:unknown,c:unknown){b=original.setup(p,c);return b}} as Component));return b}
it('wires imported class metadata and complete eligibility to the inline chooser while retaining level and known-spell restrictions',async()=>{
 const b=await bindings(),r=rule(),source=[option('already'),option('core'),option('too-high',9),option('cantrip',0)];b.rules.value=r;b.catalog.value.spells=[{...option('imported'),classes:[{index:'wizard'}]},{...option('cleric'),classes:[{index:'cleric'}]},{...option('old-version'),aliases:['already'],classes:[{index:'wizard'}]}]
 vi.mocked(srd.spells).mockResolvedValue(source);vi.mocked(srd.classSpells).mockResolvedValue(source);await b.loadSpells(r,0)
 expect(r.casting!.eligible!.map(s=>s.id)).toContain('imported');expect(b.availableSpells.value.map((s:any)=>s.index)).toEqual(['core','cantrip','imported']);expect(b.spells.value).toHaveLength(6)
 const before=JSON.stringify(mocks.store.current);b.addSpell(option('cleric'));b.addSpell(option('too-high',9));expect(b.decisions.spells).toEqual([])
 b.addSpell(option('core'));b.addSpell(option('imported'));b.addSpell(option('core'));expect(b.decisions.spells).toEqual(['core','imported']);b.removeSpell('core');expect(b.decisions.spells).toEqual(['imported']);expect(JSON.stringify(mocks.store.current)).toBe(before);expect(mocks.store.update).not.toHaveBeenCalled()
 b.grantOptions.value=[option('core')];b.addGrant(option('core'));expect(b.decisions.extraSpells).toEqual(['core']);b.addSpell(option('core'));expect(b.decisions.spells).toEqual(['imported'])
})
it('does not let a slow previous class request overwrite the new rule catalog',async()=>{
 const b=await bindings();let resolve!:(s:any)=>void;vi.mocked(srd.spells).mockImplementationOnce(()=>new Promise(r=>resolve=r)).mockResolvedValueOnce([option('new-class')]);vi.mocked(srd.classSpells).mockResolvedValue([option('new-class')]);mocks.load.mockResolvedValue(rule())
 const old=b.loadSpells(rule(),0);await b.loadRules();resolve([option('stale-class')]);await old;expect(b.spells.value.map((s:any)=>s.index)).toEqual(['new-class'])
})

it('exposes more than thirty feature spell options without hiding selected choices',async()=>{
 const b=await bindings(),f={id:'secrets',name:'Magical secrets',description:'',level:10,origin:'class',choose:2,options:Array.from({length:81},(_,i)=>({id:String(i),name:'Spell '+i,description:'',spell:String(i)}))}
 b.decisions.choices.secrets=['80'];expect(b.featureOptions(f)[0].id).toBe('80');b.featureOptionLimits.secrets=90;expect(b.featureOptions(f)).toHaveLength(81);b.featureQueries.secrets='Spell 0';expect(b.featureOptions(f).map((s:any)=>s.id)).toEqual(['80','0'])
})
