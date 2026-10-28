import {describe,it,expect} from 'vitest'
import {emptyCharacter} from '../../shared/character'
import {inspectOrcbrew} from './orcbrew'
import {sheetReferences,sheetRuleOptions} from './sheet-references'
import type {CharacterRuleLibrary} from './workshop-rules'
const library=():CharacterRuleLibrary=>({catalog:inspectOrcbrew(`{:orcpub.dnd.e5/classes {:oracle-key {:name "Dawn Oracle" :hit-die 8 :traits [{:name "Oracle Sight" :description "Class text" :level 1}]} :unrelated {:name "Hidden Class" :hit-die 10}} :orcpub.dnd.e5/subclasses {:star-school {:name "Star School" :class :oracle-key :traits [{:name "Star Sight" :description "Subclass text" :level 2}]} :hidden {:name "Hidden Subclass" :class :unrelated}} :orcpub.dnd.e5/races {:moonborn {:name "Moonborn" :speed 30 :traits []}}}`).entries,rules:[],initial:{},warnings:[]})
const hero=()=>({...emptyCharacter(),_id:'hero',updatedAt:'v1'})

describe('imported sheet references and editor identities',()=>{
 it('includes secondary multiclass subclasses but excludes unrelated definitions',()=>{
  const l=library(),c=hero();c.meta.klass='Fighter';c.meta.classLevels=[{name:'Fighter',level:2},{name:'Dawn Oracle',level:2,subclass:'Star School'}]
  const refs=sheetReferences(c,l)
  expect(refs.classes.map(e=>e.name)).toEqual(['Dawn Oracle']);expect(refs.subclasses.map(e=>e.name)).toEqual(['Star School'])
  expect(JSON.stringify(refs)).not.toContain('Hidden Class');expect(JSON.stringify(refs)).not.toContain('Hidden Subclass')
 })
 it('retains explicitly selected imported identities even when a saved display name differs',()=>{
  const l=library(),c=hero();c.meta.klass='Old class label';c.meta.classIndex=l.catalog.classes[0]!.index
  c.meta.subclass='Old subclass label';c.meta.subclassIndex=l.catalog.subclasses[0]!.index;c.meta.raceIndex=l.catalog.races[0]!.index
  const refs=sheetReferences(c,l);expect(refs.classes[0]?.name).toBe('Dawn Oracle');expect(refs.subclasses[0]?.name).toBe('Star School');expect(refs.races[0]?.name).toBe('Moonborn')
 })
 it('accepts selected legacy aliases',()=>{
  const l=library(),c=hero();l.catalog.classes[0]!.aliases=['old-oracle-id'];c.meta.classIndex='old-oracle-id'
  expect(sheetReferences(c,l).classes.map(e=>e.name)).toEqual(['Dawn Oracle'])
 })
 it('makes descriptive class, subclass and race identities selectable without inventing Workshop rules',()=>{
  const options=sheetRuleOptions(library());expect(options).toEqual(expect.arrayContaining([expect.objectContaining({name:'Dawn Oracle',ruleKind:'class'}),expect.objectContaining({name:'Star School',ruleKind:'subclass'}),expect.objectContaining({name:'Moonborn',ruleKind:'race'})]))
  expect(options.every(e=>!e.workshop)).toBe(true);expect(JSON.stringify(options)).not.toContain('Class text')
 })
})
