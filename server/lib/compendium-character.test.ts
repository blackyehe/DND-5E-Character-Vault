import { describe, it, expect } from 'vitest'
import { emptyCharacter, type Character } from '../../shared/character'
import { newWorkshopDraft, newWorkshopFeature, newWorkshopResource } from '../../shared/homebrew-workshop'
import { cloneEntry, type CompendiumDefinition } from '../../shared/compendium-editing'
import { reviewedCharacter, characterUsesDefinition, characterReviewChanges } from './compendium-character'
import {equipmentAttacks,combatAttacks} from '../../src/lib/equipment'
import { sheetReferences } from './sheet-references'
import type { WorkshopLibrary } from './workshop-library'
import {pinSelectedOptions} from './selected-options'
const hero=():Character=>({...emptyCharacter(),_id:'a'.repeat(24),updatedAt:'2026-10-23T00:00:00Z'})
describe('approved definitions',()=>{
  it('finds an active native grant by its stable ID after old fingerprint aliases have expired',()=>{
    const c=hero(),before={index:'homebrew-feats-old',name:'Old feat',optionId:'stable-id'},entry={index:'homebrew-feats-new',name:'New feat',optionId:'stable-id',aliases:[]}
    c.features=[{name:'Old feat',description:'',definition:{version:1,kind:'feats',index:before.index}}];c.compendiumRules=[{kind:'feats',index:before.index,revision:1,before,entry:before}]
    const definition:CompendiumDefinition={kind:'feats',index:entry.index,revision:2,before:entry,entry};expect(characterUsesDefinition(c,definition)).toBe(true);expect(characterUsesDefinition(c,definition,false)).toBe(true);c.features=[];expect(characterUsesDefinition(c,definition,false)).toBe(false)
  })
  it('uses each copy’s captured source when reviewing a later item revision and preserves custom values',()=>{
    const c=hero(),templateId='c'.repeat(24),baseline={name:'Focus',weight:2,description:'Second rules'}
    c.equipment=[{...baseline,templateId,templateBaseline:baseline,qty:2,equipped:true,notes:'Personal'}, {...baseline,templateId,templateBaseline:baseline,weight:9,qty:1,equipped:false,notes:'Custom weight'}]
    c.compendiumRules=[{kind:'magic-items',index:`workshop-item-${templateId}`,revision:3,before:{name:'Focus',workshopItem:{name:'Focus',weight:1,description:'First rules'}},entry:{name:'Focus',workshopItem:{name:'Focus',weight:3,description:'Third rules',benefits:[]}}}]
    const result=reviewedCharacter(c,[],{});expect(result.equipment.map(i=>i.weight)).toEqual([3,9]);expect(result.equipment.map(i=>i.description)).toEqual(['Third rules','Third rules']);expect(result.equipment.map(i=>i.notes)).toEqual(['Personal','Custom weight']);expect(result.equipment[0]!.qty).toBe(2);expect(result.equipment[0]!.equipped).toBe(true)
    expect(result.equipment[1]!.templateBaseline?.weight).toBe(3)
  })
  it('refreshes and removes captured inventory benefits through explicit character review',()=>{
    const c=hero(),benefits=[{type:'spell-attack-bonus',value:3},{type:'spell-dc-bonus',value:3}]
    const item={name:'Test focus',templateId:'b'.repeat(24),qty:1,weight:1,equipped:true,attuned:true,notes:'Saved notes',benefits:[{type:'spell-attack-bonus',value:1}]}
    c.equipment=[item];c.compendiumRules=[{kind:'magic-items',index:`workshop-item-${item.templateId}`,revision:1,before:{name:item.name,workshopItem:item},entry:{name:item.name,workshopItem:item,benefits}}]
    const result=reviewedCharacter(c,[],{})
    expect(result.equipment[0]).toMatchObject({...item,benefits});expect(result.equipment[0]!.templateBaseline?.benefits).toEqual(benefits)
    result.compendiumRules![0]!.entry.benefits=[]
    expect(reviewedCharacter(result,[],{}).equipment[0]).toMatchObject({...item,benefits:[]})
    expect(c.equipment[0]!.benefits).toEqual([{type:'spell-attack-bonus',value:1}])
  })
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
  it.each(['race','feat','item'] as const)('finds and resolves a granted-only spell from a %s without learning or preparing it',source=>{
    const c=hero(),spell='granted-spell',grant={type:'spell',value:{key:spell,ability:'cha',level:1}}
    if(source==='race'){
      const race=newWorkshopDraft('race');race.race!.spells=[{id:'grant',index:spell,name:'Granted spell',ability:'cha',level:1,usage:'Once',needsReview:false}]
      c.homebrew={bindings:[{ruleId:race.id,index:'race',revision:1,className:race.name,rule:race}],choices:{},conflicts:[],acknowledged:[]}
    }else if(source==='feat'){
      c.features=[{name:'Spell gift',description:'',definition:{version:1,kind:'feats',index:'gift'}}]
      c.compendiumRules=[{kind:'feats',index:'gift',revision:1,before:{index:'gift',name:'Spell gift'},entry:{index:'gift',name:'Spell gift',benefits:[grant]}}]
    }else c.equipment=[{name:'Spell focus',qty:1,weight:0,notes:'',equipped:true,benefits:[grant]}]
    const definition:CompendiumDefinition={kind:'spells',index:'new-spell',revision:2,before:{index:spell,name:'Granted spell'},entry:{index:'new-spell',name:'Renamed spell',spellId:'stable',aliases:[],desc:['Reviewed rules'],level:1}}
    c.compendiumRules=[...(c.compendiumRules??[]),definition]
    expect(characterUsesDefinition(c,definition,false)).toBe(true)
    const library={catalog:Object.fromEntries(['spells','feats','races','subclasses','classes','backgrounds'].map(k=>[k,[]]))} as unknown as WorkshopLibrary
    const refs=sheetReferences(c,library)
    expect(refs.spells).toHaveLength(1);expect(refs.spells[0]).toMatchObject({name:'Renamed spell',desc:['Reviewed rules'],aliases:expect.arrayContaining([spell,'new-spell'])})
    expect(c.spellcasting.known).toEqual([]);expect(c.spellcasting.prepared).toEqual([])
    if(source==='item'){c.equipment[0]!.equipped=false;expect(characterUsesDefinition(c,definition,false)).toBe(false);expect(sheetReferences(c,library).spells).toEqual([])}
  })
  it('uses exact spell/item/class source identities before falling back to names',()=>{
    const c=hero();c.meta.klass='Example';c.meta.classIndex='source-b';const d:CompendiumDefinition={kind:'classes',index:'source-a',revision:1,before:{index:'source-a',name:'Example'},entry:{index:'source-a',name:'Example'}};expect(characterUsesDefinition(c,d)).toBe(false);c.meta.classIndex='source-a';expect(characterUsesDefinition(c,d)).toBe(true)
  })
  it('matches secondary multiclass definitions independently of the primary class index',()=>{const c=hero();c.meta.classIndex='first';c.meta.classLevels=[{name:'First',level:2,index:'first'},{name:'Second',level:1,index:'second'}];expect(characterUsesDefinition(c,{kind:'classes',index:'second',revision:1,before:{index:'second',name:'Second'},entry:{index:'second',name:'Second'}})).toBe(true)})
  it('preserves item quantity, equipped state, attunement, custom notes and unrelated fields',()=>{
    const c=hero();c.equipment=[{index:'blade',name:'Blade',description:'Old',qty:3,weight:2,equipped:true,attuned:true,notes:'Mine',weapon:{dice:'1d6',damageType:'slashing',range:'Melee',finesse:false,ranged:false}}];const old=cloneEntry(c.equipment[0]!);const next={...old,description:'New',weight:4,weapon:{...old.weapon!,dice:'1d8'}};c.compendiumRules=[{kind:'equipment',index:'blade',revision:1,before:{index:'blade',name:'Blade',workshopItem:old},entry:{index:'blade',name:'Blade',workshopItem:next}}];const result=reviewedCharacter(c,[],{});expect(result.equipment[0]).toEqual({...old,description:'New',weight:4,weapon:next.weapon})
  })
  it('removes an unchanged source trait, updates its neighbour and adds the new trait without duplicates',()=>{
    const c=hero();c.meta.background='Test';c.features=[{name:'A',description:'Old A',origin:'background'},{name:'B',description:'Old B',origin:'background'}]
    c.compendiumRules=[{kind:'backgrounds',index:'test',revision:1,before:{index:'test',name:'Test',traits:[{name:'A',description:'Old A'},{name:'B',description:'Old B'}]},entry:{index:'test',name:'Test',traits:[{name:'B',description:'New B'}]}}]
    c.compendiumRules[0]!.entry.traits=[{name:'B',description:'New B'},{name:'C',description:'New C'}]
    const result=reviewedCharacter(c,[],{});expect(result.features.map(f=>f.name)).toEqual(['B','C']);expect(result.features[0]?.description).toBe('New B')
    expect(result.features.every(f=>f.compendiumSource?.index==='test')).toBe(true);expect(reviewedCharacter(result,[],{})).toEqual(result)
  })
  it('preserves custom removed traits and unrelated features, and reports the retained custom trait',()=>{
    const c=hero();c.meta.subrace='Test';c.meta.subraceIndex='test';c.features=[{name:'A',description:'Personal notes',origin:'racial',pinned:true},{name:'Manual',description:'Keep me',origin:'other'}]
    c.compendiumRules=[{kind:'subraces',index:'test',revision:1,before:{index:'test',name:'Test',traits:[{name:'A',description:'Original A'}]},entry:{index:'test',name:'Test',traits:[{name:'B',description:'New B'}]}}]
    const result=reviewedCharacter(c,[],{});expect(result.features.map(f=>f.name)).toEqual(['A','Manual','B']);expect(result.features[0]).toMatchObject({description:'Personal notes',pinned:true});expect(result.homebrew?.conflicts.some(row=>row.message.includes('edited feature'))).toBe(true);expect(reviewedCharacter(result,[],{})).toEqual(result)
  })
  it('renames stable-ID traits without replacing local display settings and preserves a customised acquisition level',()=>{
    const c=hero();c.features=[{name:'Gift',description:'Original',origin:'feat',level:6,pinned:true,definition:{version:1,kind:'feats',index:'gift'}}]
    c.compendiumRules=[{kind:'feats',index:'gift',revision:1,before:{index:'gift',name:'Gift',description:'Original'},entry:{index:'gift',name:'Better gift',description:'Updated'}}]
    const result=reviewedCharacter(c,[],{});expect(result.features[0]).toMatchObject({name:'Better gift',description:'Updated',level:6,pinned:true,definition:c.features[0]!.definition});expect(reviewedCharacter(result,[],{})).toEqual(result)
    result.meta.background='Test';result.features.push({name:'Old name',description:'Old',origin:'background',pinned:true,combatHidden:true,order:4})
    result.compendiumRules!.push({kind:'backgrounds',index:'test',revision:1,before:{index:'test',name:'Test',traits:[{id:'stable',name:'Old name',description:'Old'}]},entry:{index:'test',name:'Test',traits:[{id:'stable',name:'New name',description:'New'}]}})
    expect(reviewedCharacter(result,[],{}).features[1]).toMatchObject({name:'New name',description:'New',pinned:true,combatHidden:true,order:4})
  })
  it('does not remove ambiguous same-named traits, class grants, or traits from an option no longer selected',()=>{
    const c=hero();c.meta.background='Test';c.features=[{name:'A',description:'A',origin:'background'},{name:'A',description:'A',origin:'background'},{name:'Class trait',description:'Old',ruleId:'class-rule',origin:'class'}]
    c.compendiumRules=[{kind:'backgrounds',index:'test',revision:1,before:{index:'test',name:'Test',traits:[{name:'A',description:'A'},{name:'Class trait',description:'Old'}]},entry:{index:'test',name:'Test',traits:[{name:'B',description:'B'}]}}]
    const result=reviewedCharacter(c,[],{});expect(result.features.map(f=>f.name)).toEqual(['A','A','Class trait','B']);expect(result.homebrew?.conflicts.length).toBeGreaterThan(0)
    c.meta.background='Different';expect(reviewedCharacter(c,[],{}).features).toEqual(c.features)
  })
  it('removes source-owned child traits when their selected option is removed',()=>{
    const c=hero(),entry={index:'gift',name:'Gift',description:'Option rules',traits:[{name:'A',description:'A rules'},{name:'B',description:'B rules'}]}
    c.features=[{name:'Gift',description:'Option rules',level:6,definition:{version:1,kind:'feats',index:'gift'}},{name:'Personal',description:'Keep'}]
    c.compendiumRules=[{kind:'feats',index:'gift',revision:1,before:entry,entry}]
    const result=reviewedCharacter(c,[],{});expect(result.features.filter(f=>f.compendiumSource)).toHaveLength(2);expect(result.features.filter(f=>f.compendiumSource).every(f=>f.level===6)).toBe(true)
    const library={catalog:{feats:[]}} as unknown as WorkshopLibrary
    const removed=pinSelectedOptions({...result,features:result.features.filter(f=>!f.definition)},library,result)
    expect(removed.features).toEqual([{name:'Personal',description:'Keep'}]);expect(removed.compendiumRules).toEqual([])
  })
  it('keeps the acquisition row stable when a feat replaces or removes its last trait',()=>{
    const c=hero(),before={index:'gift',name:'Gift',description:'Option rules',traits:[{name:'A',description:'A rules'}]}
    c.features=[{name:'Gift',description:'A rules',level:6,definition:{version:1,kind:'feats',index:'gift'}}]
    c.compendiumRules=[{kind:'feats',index:'gift',revision:1,before,entry:{...before,description:'Updated option rules',traits:[{name:'B',description:'B rules'}]}}]
    const result=reviewedCharacter(c,[],{});expect(result.features.map(f=>f.name)).toEqual(['Gift','B']);expect(result.features[0]).toMatchObject({description:'Updated option rules',level:6,definition:c.features[0]!.definition});expect(reviewedCharacter(result,[],{})).toEqual(result)
    result.compendiumRules![0]={...result.compendiumRules![0]!,before:result.compendiumRules![0]!.entry,entry:{index:'gift',name:'Gift',description:'Final rules',traits:[]}}
    const removed=reviewedCharacter(result,[],{});expect(removed.features).toHaveLength(1);expect(removed.features[0]).toMatchObject({name:'Gift',description:'Final rules',definition:c.features[0]!.definition});expect(reviewedCharacter(removed,[],{})).toEqual(removed)
  })
  it('refreshes derived saved weapon attacks, including a rename, while preserving custom fields and notes',()=>{
    const c=hero(),item={index:'blade',name:'Blade',qty:1,weight:1,equipped:true,notes:'Item notes',weapon:{dice:'1d6',range:'Melee',damageType:'Slashing',finesse:false,ranged:false}}
    c.equipment=[item];c.attacks=[{name:'Blade',ability:'str',range:'Melee',damageDice:'1d6',damageType:'Slashing',magicBonus:0,damageBonus:2,notes:'Attack notes',proficient:false,addAbilityDamage:false},{name:'Blade',ability:'cha',range:'Special',damageDice:'2d10',damageType:'Fire',magicBonus:4,damageBonus:3,notes:'Custom attack'}]
    const next={...item,name:'Greater blade',magicBonus:1,weapon:{...item.weapon,dice:'1d8',range:'60 feet',damageType:'Cold',ranged:true}}
    c.compendiumRules=[{kind:'equipment',index:'blade',revision:1,before:{index:'blade',name:'Blade',workshopItem:item},entry:{index:'blade',name:next.name,workshopItem:next}}]
    const result=reviewedCharacter(c,[],{})
    expect(result.attacks[0]).toEqual({...c.attacks[0],name:next.name,ability:'dex',range:'60 feet',damageDice:'1d8',damageType:'Cold',magicBonus:1})
    expect(result.attacks[1]).toEqual({...c.attacks[1],name:next.name});expect(result.equipment[0]!.notes).toBe('Item notes')
    expect(equipmentAttacks(result,result.equipment[0]!)[0]!.text).toContain('1d8');expect(combatAttacks(result)).toHaveLength(2)
    expect(characterReviewChanges(c,result).some(row=>row.field==='attacks')).toBe(true)
    expect(reviewedCharacter(result,[],{})).toEqual(result);expect(c.attacks[0]!.damageDice).toBe('1d6')
  })
  it('does not guess which same-named inventory copy owns a legacy attack',()=>{
    const c=hero(),item={index:'blade',name:'Blade',qty:1,weight:1,equipped:true,notes:'',weapon:{dice:'1d6',range:'Melee',damageType:'Slashing',finesse:false,ranged:false}}
    c.equipment=[item,{...item,index:'other-blade'}];c.attacks=[{name:'Blade',ability:'str',range:'Melee',damageDice:'1d6',damageType:'Slashing',magicBonus:0,damageBonus:0,notes:''}]
    c.compendiumRules=[{kind:'equipment',index:'blade',revision:1,before:{index:'blade',name:'Blade',workshopItem:item},entry:{index:'blade',name:'Blade',workshopItem:{...item,weapon:{...item.weapon,dice:'1d8'}}}}]
    expect(reviewedCharacter(c,[],{}).attacks).toEqual(c.attacks)
  })
  it('repairs a saved attack left behind by an already-approved weapon update',()=>{
    const c=hero(),old={index:'blade',name:'Blade',qty:1,weight:1,equipped:true,notes:'',weapon:{dice:'1d6',range:'Melee',damageType:'Slashing',finesse:false,ranged:false}},next={...old,weapon:{...old.weapon,dice:'1d8'}}
    c.equipment=[next];c.attacks=[{name:'Blade',ability:'str',range:'Melee',damageDice:'1d6',damageType:'Slashing',magicBonus:0,damageBonus:0,notes:''}]
    c.compendiumRules=[{kind:'equipment',index:'blade',revision:1,before:{index:'blade',name:'Blade',workshopItem:old},entry:{index:'blade',name:'Blade',workshopItem:next}}]
    expect(reviewedCharacter(c,[],{}).attacks[0]!.damageDice).toBe('1d8')
  })
  it('reviews imported item descriptions from the reader even when the original filter item has no description',()=>{
    const c=hero(),item={name:'Example',qty:1,weight:1,equipped:false,notes:'',kind:'gear' as const,index:'example'};c.equipment=[{...item,description:'Original item text'}]
    c.compendiumRules=[{kind:'equipment',index:'example',revision:1,before:{index:'example',name:'Example',workshopItem:item,itemView:{description:'Original item text'}},entry:{index:'example',name:'Example',workshopItem:item,itemView:{description:'Reviewed item text'}}}]
    expect(reviewedCharacter(c,[],{}).equipment[0]?.description).toBe('Reviewed item text')
  })
})
