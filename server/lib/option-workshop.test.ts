import {describe,it,expect} from 'vitest'
import {newOptionDraft} from '../../shared/option-workshop'
import {inspectOrcbrew,buildOrcbrewCatalog} from './orcbrew'
import {validatedOption,optionKey,optionRecord,nativeOption} from './option-workshop'
import {placeOptionEntry} from './workshop-pack'
import {archiveDefinition,restoreDefinition} from './workshop-trash'
import {pinSelectedOptions} from './selected-options'
import {emptyCharacter} from '../../shared/character'
import {sheetReferences} from './sheet-references'
import {characterBenefits} from '../../shared/rule-benefits'
import type {CharacterRuleLibrary} from './workshop-rules'
const make=(kind:'feats'|'backgrounds'='feats')=>{const draft=newOptionDraft(kind);draft.body.name='Moon Scholar';draft.body.description='Preserved rules';draft.body.featureName='Scholar feature';draft.body.featureDescription='Feature rules';draft.benefits=[{type:'walking-speed',value:40,level:1}];return validatedOption(draft)}
const parse=(source:string)=>buildOrcbrewCatalog([{id:'a'.repeat(24),filename:'My Options.orcbrew',parsed:inspectOrcbrew(source)}])
const lib=(source:string)=>({catalog:parse(source),rules:[],initial:{},warnings:[]}) as CharacterRuleLibrary
const hero=()=>({...emptyCharacter(),_id:'hero',updatedAt:'v1'})
describe('authored feat/background pack and selection lifecycle',()=>{
 it.each(['feats','backgrounds'] as const)('roundtrips %s with rules, typed benefits and same-name identities',kind=>{
  const d=make(kind),text=placeOptionEntry(undefined,kind,optionKey(d.id),optionRecord(d,1,[]),d.id),entry=parse(text)[kind][0]!
  expect(nativeOption(entry)?.body).toEqual(d.body);expect(entry.benefits).toEqual(d.benefits)
  const other=make(kind);const two=placeOptionEntry(text,kind,optionKey(other.id),optionRecord(other,1,[]),other.id);expect(parse(two)[kind]).toHaveLength(2)
 })
 it('preserves unrelated exact EDN and unsupported native fields while renaming; retains old IDs',()=>{
  const d=make(),extra='{:orcpub.dnd.e5/other {:untouched {:name "Original" :unknown [1 2 3]}}}',first=placeOptionEntry(extra,d.kind,optionKey(d.id),{...optionRecord(d,1,[]),':unknown':'Retain me'},d.id),origin=parse(first).feats[0]!
  d.body.name='Renamed Scholar';const next=placeOptionEntry(first,d.kind,optionKey(d.id),optionRecord(d,2,[origin.index],origin),d.id),entry=parse(next).feats[0]!
  expect(next).toContain(':unknown [1 2 3]');expect(entry.details).toMatchObject({':unknown':'Retain me'});expect(entry.aliases).toContain(origin.index);expect(entry.name).toBe('Renamed Scholar')
  const c=hero();c.features=[{name:'Old display label',description:'Saved text',origin:'feat',definition:{version:1,kind:'feats',index:origin.index}}]
  expect(sheetReferences(c,lib(next)).feats).toHaveLength(1)
 })
 it('pins initial grants, keeps them through pack edits/deletion, and removes them with deselection',()=>{
  const d=make(),source=placeOptionEntry(undefined,'feats',optionKey(d.id),optionRecord(d,1,[]),d.id),l=lib(source),entry=l.catalog.feats[0]!,c=hero();c.features=[{name:entry.name,description:entry.description as string,origin:'feat',definition:{version:1,kind:'feats',index:entry.index}}]
  const selected=pinSelectedOptions(c,l);expect(characterBenefits(selected).speed).toBe(40)
  expect(characterBenefits({...selected,features:selected.features.map(f=>({...f,level:5}))}).speed).toBe(selected.combat.speed)
  d.benefits=[{type:'walking-speed',value:80,level:1}];const changed=placeOptionEntry(source,'feats',optionKey(d.id),optionRecord(d,2,[entry.index],entry),d.id)
  const saved=pinSelectedOptions(selected,lib(changed),selected);expect(characterBenefits(saved).speed).toBe(40);expect(saved.compendiumRules).toHaveLength(1)
  const newId=lib(changed).catalog.feats[0]!.index,reselected=pinSelectedOptions({...saved,features:saved.features.map(f=>({...f,definition:{version:1,kind:'feats',index:newId}}))},lib(changed),saved)
  expect(characterBenefits(reselected).speed).toBe(40);expect(reselected.compendiumRules).toHaveLength(1)
  const missing=lib('{:orcpub.dnd.e5/feats {}}');expect(characterBenefits(pinSelectedOptions(saved,missing,saved)).speed).toBe(40)
  expect(sheetReferences(saved,missing).feats[0]).toMatchObject({sourceUnavailable:true,description:'Preserved rules'})
  expect(pinSelectedOptions({...saved,features:[]},l,saved).compendiumRules).toEqual([])
  expect(()=>pinSelectedOptions(c,missing)).toThrow(/unavailable/)
 })
 it('exposes only the explicitly chosen same-name background/feat, with source-qualified legacy recovery',()=>{
  const a=make('backgrounds'),b=make('backgrounds');let source=placeOptionEntry(undefined,a.kind,optionKey(a.id),optionRecord(a,1,[]),a.id);source=placeOptionEntry(source,b.kind,optionKey(b.id),optionRecord(b,1,[]),b.id)
  const l=lib(source),c=hero();c.meta.background='Moon Scholar';expect(sheetReferences(c,l).backgrounds).toEqual([])
  c.meta.backgroundIndex=l.catalog.backgrounds[0]!.index;expect(sheetReferences(c,l).backgrounds.map(e=>e.index)).toEqual([c.meta.backgroundIndex])
  c.meta.backgroundIndex='missing';expect(sheetReferences(c,l).backgrounds).toEqual([])
  const single=lib(placeOptionEntry(undefined,a.kind,optionKey(a.id),optionRecord(a,1,[]),a.id));delete c.meta.backgroundIndex;c.meta.background=String(single.catalog.backgrounds[0]!.displayName);expect(sheetReferences(c,single).backgrounds).toHaveLength(1)
 })
 it.each(['feats','backgrounds'] as const)('archives and restores %s without losing unsupported fields or saved identity',kind=>{
  const d=make(kind),source=placeOptionEntry(undefined,kind,optionKey(d.id),optionRecord(d,1,[]),d.id),entry=parse(source)[kind][0]!,archived=archiveDefinition(source,kind==='feats'?'feat':'background',entry)
  expect(inspectOrcbrew(archived.source).entries[kind]).toEqual([]);expect(parse(restoreDefinition(archived.source,archived.parts))[kind][0]!.index).toBe(entry.index)
  expect(()=>restoreDefinition(source,archived.parts)).toThrow(/already in use/)
 })
 it('rejects invalid authored benefits, hostile keys and conflicting native IDs',()=>{
  const d=make();expect(()=>validatedOption({...d,body:{...d.body,name:' '}})).toThrow();expect(()=>validatedOption({...d,benefits:[{type:'walking-speed',value:-1}]})).toThrow()
  const source=placeOptionEntry(undefined,d.kind,optionKey(d.id),optionRecord(d,1,[]),d.id);expect(()=>placeOptionEntry(source,d.kind,optionKey(d.id),optionRecord(make(),1,[]),'other-id')).toThrow(/another option/)
 })
 it('never replaces a different same-name selection when a pinned source disappears',()=>{
  const a=make(),b=make();let source=placeOptionEntry(undefined,'feats',optionKey(a.id),optionRecord(a,1,[]),a.id);source=placeOptionEntry(source,'feats',optionKey(b.id),optionRecord(b,1,[]),b.id);const l=lib(source),c=hero();c.features=l.catalog.feats.map(e=>({name:e.name,description:String(e.description),origin:'feat',definition:{version:1,kind:'feats',index:e.index}}));const pinned=pinSelectedOptions(c,l)
  const remaining=lib(placeOptionEntry(undefined,'feats',optionKey(b.id),optionRecord(b,1,[]),b.id)),refs=sheetReferences(pinned,remaining)
  expect(refs.feats).toHaveLength(2);expect(refs.feats.filter(e=>e.sourceUnavailable)).toHaveLength(1);expect(new Set(refs.feats.map(e=>e.index)).size).toBe(2)
 })
})
