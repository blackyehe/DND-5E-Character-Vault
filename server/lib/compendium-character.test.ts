import { describe, it, expect } from 'vitest'
import { emptyCharacter, type Character } from '../../shared/character'
import { newWorkshopDraft, newWorkshopFeature, newWorkshopResource } from '../../shared/homebrew-workshop'
import { cloneEntry, type CompendiumDefinition } from '../../shared/compendium-editing'
import { reviewedCharacter, characterUsesDefinition } from './compendium-character'
import { sheetReferences } from './sheet-references'
import type { WorkshopLibrary } from './workshop-library'
const hero=():Character=>({...emptyCharacter(),_id:'a'.repeat(24),updatedAt:'2026-10-23T00:00:00Z'})
describe('approved definitions',()=>{
  it('reconciles class features, slots and trackers without resetting current HP or spent uses',()=>{
    const old=newWorkshopDraft();old.name='Test class';old.hitDie=8;old.features=[{...newWorkshopFeature(),name:'Test feature',description:'Old text'}];old.resources=[{...newWorkshopResource(),name:'Focus',base:3,multiplier:0}];old.magic.enabled=true
    const next=cloneEntry(old);next.features[0]!.description='New text';next.resources[0]!.base=5;next.hitDie=10
    const c=hero();c.meta.klass=old.name;c.meta.classIndex='test-class';c.combat.hpMax=8;c.combat.hpCurrent=4;c.homebrew={bindings:[{ruleId:old.id,index:'test-class',revision:1,className:old.name,rule:old}],choices:{},conflicts:[],acknowledged:[]};c.features=[{ruleId:old.id,featureId:old.features[0]!.id,name:'Test feature',description:'Old text',origin:'class'}];c.resources=[{ruleId:old.id,id:`workshop:${old.id}:${old.resources[0]!.id}`,name:'Focus',max:3,used:2,recovery:'long'}];c.spellcasting.slots.l1={max:2,used:1}
    c.compendiumRules=[{kind:'classes',index:'test-class',revision:2,before:{index:'test-class',name:old.name,workshop:old},entry:{index:'test-class',name:next.name,workshop:next}}]
    const rule={id:old.id,index:'test-class',revision:1,previousIndexes:[],previousNames:[],draft:old},result=reviewedCharacter(c,[rule],{[old.id]:old})
    expect(result.features.find(f=>f.name==='Test feature')?.description).toBe('New text');expect(result.resources?.[0]?.max).toBe(5);expect(result.resources?.[0]?.used).toBe(2);expect(result.combat.hpCurrent).toBe(4);expect(result.combat.hpMax).toBe(10);expect(result.spellcasting.slots.l1?.used).toBe(1)
    expect(reviewedCharacter(result,[rule],{[old.id]:old})).toEqual(result)
    expect(c.features[0]?.description).toBe('Old text')
  })
  it('keeps per-character spell editions isolated in protected sheet references',()=>{
    const c=hero();c.spellcasting.known=['acid-arrow'];const def:CompendiumDefinition={kind:'spells',index:'acid-arrow',revision:1,before:{index:'acid-arrow',name:'Acid Arrow'},entry:{index:'acid-arrow',name:'Acid Arrow',desc:['Reviewed spell text'],level:2,aliases:[]}};c.compendiumRules=[def]
    const catalog=Object.fromEntries(['spells','feats','races','subclasses','classes','backgrounds'].map(k=>[k,[]]));const library={catalog} as unknown as WorkshopLibrary
    const refs=sheetReferences(c,library);expect((refs.spells.find(s=>s.index==='acid-arrow') as Record<string,unknown>)?.desc).toEqual(['Reviewed spell text']);delete c.compendiumRules;expect((sheetReferences(c,library).spells.find(s=>s.index==='acid-arrow') as Record<string,unknown>)?.desc).not.toEqual(['Reviewed spell text'])
  })
  it('uses exact spell/item/class source identities before falling back to names',()=>{
    const c=hero();c.meta.klass='Example';c.meta.classIndex='source-b';const d:CompendiumDefinition={kind:'classes',index:'source-a',revision:1,before:{index:'source-a',name:'Example'},entry:{index:'source-a',name:'Example'}};expect(characterUsesDefinition(c,d)).toBe(false);c.meta.classIndex='source-a';expect(characterUsesDefinition(c,d)).toBe(true)
  })
  it('matches secondary multiclass definitions independently of the primary class index',()=>{const c=hero();c.meta.classIndex='first';c.meta.classLevels=[{name:'First',level:2,index:'first'},{name:'Second',level:1,index:'second'}];expect(characterUsesDefinition(c,{kind:'classes',index:'second',revision:1,before:{index:'second',name:'Second'},entry:{index:'second',name:'Second'}})).toBe(true)})
  it('preserves item quantity, equipped state, attunement, custom notes and unrelated fields',()=>{
    const c=hero();c.equipment=[{index:'blade',name:'Blade',description:'Old',qty:3,weight:2,equipped:true,attuned:true,notes:'Mine',weapon:{dice:'1d6',damageType:'slashing',range:'Melee',finesse:false,ranged:false}}];const old=cloneEntry(c.equipment[0]!);const next={...old,description:'New',weight:4,weapon:{...old.weapon!,dice:'1d8'}};c.compendiumRules=[{kind:'equipment',index:'blade',revision:1,before:{index:'blade',name:'Blade',workshopItem:old},entry:{index:'blade',name:'Blade',workshopItem:next}}];const result=reviewedCharacter(c,[],{});expect(result.equipment[0]).toEqual({...old,description:'New',weight:4,weapon:next.weapon})
  })
  it('retains removed generic traits instead of renaming them to a neighbouring trait',()=>{
    const c=hero();c.meta.background='Test';c.features=[{name:'A',description:'Old A',origin:'background'},{name:'B',description:'Old B',origin:'background'}]
    c.compendiumRules=[{kind:'backgrounds',index:'test',revision:1,before:{index:'test',name:'Test',traits:[{name:'A',description:'Old A'},{name:'B',description:'Old B'}]},entry:{index:'test',name:'Test',traits:[{name:'B',description:'New B'}]}}]
    const result=reviewedCharacter(c,[],{});expect(result.features[0]?.name).toBe('A');expect(result.features[0]?.description).toBe('Old A');expect(result.features[1]?.description).toBe('New B')
  })
  it('reviews imported item descriptions from the reader even when the original filter item has no description',()=>{
    const c=hero(),item={name:'Example',qty:1,weight:1,equipped:false,notes:'',kind:'gear' as const,index:'example'};c.equipment=[{...item,description:'Original item text'}]
    c.compendiumRules=[{kind:'equipment',index:'example',revision:1,before:{index:'example',name:'Example',workshopItem:item,itemView:{description:'Original item text'}},entry:{index:'example',name:'Example',workshopItem:item,itemView:{description:'Reviewed item text'}}}]
    expect(reviewedCharacter(c,[],{}).equipment[0]?.description).toBe('Reviewed item text')
  })
})
