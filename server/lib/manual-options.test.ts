import {describe,it,expect} from 'vitest'
import {newOptionDraft,restoreOptionDraft} from '../../shared/option-workshop'
import {type ManualOptionKind} from '../../shared/option-kinds'
import {emptyCharacter,type Character,type CharacterFeature} from '../../shared/character'
import {manualOptionProblem} from '../../shared/manual-options'
import {validatedOption,optionKey,optionRecord} from './option-workshop'
import {placeOptionEntry} from './workshop-pack'
import {inspectOrcbrew,buildOrcbrewCatalog} from './orcbrew'
import {pinSelectedOptions} from './selected-options'
import {characterBenefits} from '../../shared/rule-benefits'
import {sheetReferences} from './sheet-references'
import {archiveDefinition,restoreDefinition} from './workshop-trash'
import type {CharacterRuleLibrary} from './workshop-rules'
const MANUAL_OPTION_KINDS=['invocations','boons'] as const
const hero=():Character=>({...emptyCharacter(),_id:'hero',updatedAt:'v1'})
const library=(source:string)=>({catalog:buildOrcbrewCatalog([{id:'a'.repeat(24),filename:'Options.orcbrew',parsed:inspectOrcbrew(source)}]),rules:[],initial:{},warnings:[]}) as CharacterRuleLibrary
const make=(kind:ManualOptionKind)=>{const d=newOptionDraft(kind);d.body.name='Shared name';d.body.description='Full rules';d.body.prerequisites='Review prerequisites';d.benefits=[{type:'saving-throw-bonus',value:2,level:1}];return validatedOption(d)}
const feature=(kind:ManualOptionKind,index:string,level=1):CharacterFeature=>({name:'Shared name',description:'Full rules',origin:'other',level,definition:{version:1,kind,index,grantConfirmed:true}})
describe('explicit invocation and boon selections',()=>{
 it.each(MANUAL_OPTION_KINDS)('roundtrips %s authoring, confirms selection, pins grants and restores deleted sources',kind=>{
  const d=make(kind);expect(restoreOptionDraft(d).kind).toBe(kind);let source=placeOptionEntry(undefined,kind,optionKey(d.id),optionRecord(d,1,[]),d.id),l=library(source),entry=l.catalog[kind]![0]!,c=hero();c.features=[feature(kind,entry.index)]
  const pinned=pinSelectedOptions(c,l);expect(characterBenefits(pinned).saveBonus).toBe(2);expect(sheetReferences(pinned,l)[kind]).toHaveLength(1)
  const future={...pinned,features:[feature(kind,entry.index,5)]};expect(characterBenefits(future).saveBonus).toBe(0);expect(characterBenefits({...future,meta:{...future.meta,level:5}}).saveBonus).toBe(2)
  expect(()=>pinSelectedOptions({...c,features:[{...c.features[0]!,definition:{...c.features[0]!.definition!,grantConfirmed:false}}]},l)).toThrow(/Confirm/)
  d.body.name='Renamed';d.benefits=[{type:'saving-throw-bonus',value:7,level:1}];source=placeOptionEntry(source,kind,optionKey(d.id),optionRecord(d,2,[entry.index],entry),d.id);l=library(source)
  const unchanged=pinSelectedOptions(pinned,l,pinned);expect(characterBenefits(unchanged).saveBonus).toBe(2);expect(sheetReferences(unchanged,l)[kind]).toHaveLength(1)
  const current=l.catalog[kind]![0]!,archived=archiveDefinition(source,kind==='invocations'?'invocation':'boon',current),missing=library(archived.source)
  expect(sheetReferences(unchanged,missing)[kind][0]).toMatchObject({sourceUnavailable:true,description:'Full rules'});expect(characterBenefits(pinSelectedOptions(unchanged,missing,unchanged)).saveBonus).toBe(2)
  expect(library(restoreDefinition(archived.source,archived.parts)).catalog[kind]![0]!.index).toBe(current.index)
  expect(pinSelectedOptions({...unchanged,features:[]},l,unchanged).compendiumRules).toEqual([])
 })
 it('separates equal names across categories and sends only selected definitions',()=>{
  let source='';const entries:Record<string,string>={}
  for(const kind of MANUAL_OPTION_KINDS){const d=make(kind);source=placeOptionEntry(source||undefined,kind,optionKey(d.id),optionRecord(d,1,[]),d.id)}
  const l=library(source);for(const kind of MANUAL_OPTION_KINDS)entries[kind]=l.catalog[kind]![0]!.index
  const c=hero();c.features=[feature('invocations',entries.invocations!)];const refs=sheetReferences(pinSelectedOptions(c,l),l);expect(refs.invocations).toHaveLength(1);expect(refs.boons).toEqual([])
  const both=pinSelectedOptions({...c,features:[...c.features,feature('boons',entries.boons!)]},l);expect(characterBenefits(both).saveBonus).toBe(4)
  expect(sheetReferences(both,l).boons).toHaveLength(1)
 })
 it.each(MANUAL_OPTION_KINDS)('preserves legacy reviewed %s without demanding a new ID or silently removing grants',kind=>{
  const c=hero(),entry={index:'legacy-id',name:'Legacy rules',benefits:[{type:'saving-throw-bonus',value:2,level:1}]};c.features=[{name:'Legacy rules',description:'Saved text',origin:'other'}];c.compendiumRules=[{kind,index:entry.index,revision:1,before:entry,entry}]
  const saved=pinSelectedOptions(c,library('{:orcpub.dnd.e5/other {}}'),c);expect(characterBenefits(saved).saveBonus).toBe(2);expect(sheetReferences(saved,library('{:orcpub.dnd.e5/other {}}'))[kind]).toHaveLength(1)
 })
 it('rejects unreadable selections, missing acknowledgements and invalid acquired levels',()=>{
  expect(manualOptionProblem(null)).toMatch(/unreadable/);expect(manualOptionProblem(feature('boons','id',0))).toMatch(/level/);expect(manualOptionProblem(feature('boons','id',21))).toMatch(/level/)
  expect(manualOptionProblem({...feature('invocations','id'),definition:{version:1,kind:'invocations',index:'id'}})).toMatch(/Confirm/)
 })
})
