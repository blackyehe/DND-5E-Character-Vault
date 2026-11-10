import {expect,it} from 'vitest'
import {eligibleClassSpells,mergeAdvancementSpells,queryAdvancementSpells,spellIsKnown,type AdvancementSpell} from './advancement-spells'
import {newWorkshopDraft} from '../../shared/homebrew-workshop'
import type {AdvancementRules} from '../../shared/level-up'
const rules=():AdvancementRules=>({name:'Wizard',index:'wizard',source:'2014 SRD',classLevel:7,subclassLevel:2,hitDie:6,subclasses:[],features:[],asi:false,warnings:[]})
const spell=(index:string,level=2,extra:Partial<AdvancementSpell>={}):AdvancementSpell=>({index,name:index,url:'',level,...extra})
it('adds explicitly class-compatible imported versions without admitting unrelated or unnamed class guesses',()=>{
 const spells=[spell('shield'),spell('hb-wizard',3,{classes:[{index:'wizard'}]}),spell('hb-cleric',3,{classes:[{index:'cleric'}]}),spell('homebrew-shield',1,{contentKey:'shield'}),spell('other-wizard',2,{classes:[{index:'homebrew-other',name:'Wizard'}]})]
 expect(eligibleClassSpells(spells,rules(),['shield']).map(s=>s.index)).toEqual(['shield','hb-wizard'])
})
it('respects authored Workshop lists, stable aliases, legacy content keys and subclass extras',()=>{
 const r=rules();r.source='Workshop';r.workshop=newWorkshopDraft('class');r.workshop.magic.spellList=['old-wand','legacy-spell'];r.spellListExtras=['patron-spell']
 const spells=[spell('new-wand',1,{aliases:['old-wand']}),spell('new-legacy',2,{contentKey:'legacy-spell'}),spell('patron-spell'),spell('other',2,{classes:[{index:'wizard'}]})]
 expect(eligibleClassSpells(spells,r,[]).map(s=>s.index)).toEqual(['new-wand','new-legacy','patron-spell']);expect(spellIsKnown(spells[0]!,['old-wand'])).toBe(true);expect(spellIsKnown(spells[1]!,['legacy-spell'])).toBe(false)
})
it('keeps imported class definitions without authored lists under the existing manual-review policy and rejects unknown levels',()=>{
 const r=rules();r.source='Workshop';expect(eligibleClassSpells([spell('one'),spell('bad',NaN),spell('bad-level',10)],r,[]).map(s=>s.index)).toEqual(['one'])
})
it('returns every matching spell, supports level/name/source sorting and does not mutate or merge distinct source versions',()=>{
 const spells=Array.from({length:81},(_,i)=>spell(`spell-${i}`,i%5,{name:`Name ${String(i).padStart(2,'0')}`,sourcePack:i%2?'South':'North'}));const before=JSON.stringify(spells)
 expect(queryAdvancementSpells(spells,'','','level')).toHaveLength(81);expect(queryAdvancementSpells(spells,'name 80','','name')[0]!.index).toBe('spell-80');expect(queryAdvancementSpells(spells,'south','2','source').every(s=>s.level===2&&s.sourcePack==='South')).toBe(true);expect(queryAdvancementSpells(spells,'','','name')[0]!.name).toBe('Name 00');expect(JSON.stringify(spells)).toBe(before)
 expect(mergeAdvancementSpells([spell('same',1)],[spell('same',2),spell('distinct',1,{contentKey:'same'})])).toMatchObject([{index:'same',level:2},{index:'distinct',level:1}])
})
