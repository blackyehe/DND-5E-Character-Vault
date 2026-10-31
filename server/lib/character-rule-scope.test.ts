import {beforeEach,describe,it,expect,vi} from 'vitest'
import {createHash} from 'node:crypto'
import {characterRuleExtraKinds,CHARACTER_RULE_BASE_KINDS} from './workshop-rules'
const mocks=vi.hoisted(()=>({read:vi.fn(),full:vi.fn(),warm:vi.fn(),find:vi.fn()}))
vi.mock('../models/CustomContent',()=>({CustomContent:{find:mocks.find}}))
vi.mock('../env',()=>({env:{COMPENDIUM_READER:'prepared',COMPENDIUM_PREPARED_USERS:'*'}}))
vi.mock('./workshop-library',()=>({workshopLibrary:mocks.full,warmWorkshopRules:mocks.warm,workshopRevision:async()=>createHash('sha256').update('[]').digest('hex')}))
vi.mock('./compendium-components',()=>({componentMetadata:async()=>({}),readComponentCatalogues:mocks.read}))
beforeEach(()=>{vi.resetModules();mocks.read.mockReset().mockResolvedValue([]);mocks.full.mockReset().mockImplementation(()=>{throw Error('Unexpected full-library fallback')});mocks.warm.mockReset().mockReturnValue(undefined);mocks.find.mockReset().mockImplementation(()=>({select:()=>({sort:()=>({lean:async()=>[]})})}))})
describe('selection-scoped prepared character rules',()=>{
 it('keeps ordinary characters on the six original categories and detects extra selections, ancestry and reviewed legacy rules',()=>{
  expect(characterRuleExtraKinds({})).toEqual([])
  expect(characterRuleExtraKinds({meta:{subrace:'High Elf'},features:[{definition:{kind:'selections'}}],compendiumRules:[{kind:'boons'}],proficiencies:{languages:['Elvish']}})).toEqual(['boons','selections','languages','subraces'])
  expect(characterRuleExtraKinds({features:null,meta:{subrace:42}},['other','not-a-kind'])).toEqual(['other'])
 })
 it('grows one current owner cache only when a missing selected category is needed; existing supersets serve narrower requests',async()=>{
  const {characterRuleLibrary}=await import('./character-rule-library')
  const base=await characterRuleLibrary('scope-owner',[]);expect(Object.keys(base.catalog)).toEqual([...CHARACTER_RULE_BASE_KINDS]);expect(mocks.read.mock.calls[0]![1]).toEqual([...CHARACTER_RULE_BASE_KINDS])
  await characterRuleLibrary('scope-owner',['selections']);expect(mocks.read.mock.calls[1]![1]).toEqual([...CHARACTER_RULE_BASE_KINDS,'selections'])
  await characterRuleLibrary('scope-owner',[]);expect(mocks.read).toHaveBeenCalledTimes(2)
  await characterRuleLibrary('scope-owner',['subraces']);expect(mocks.read.mock.calls[2]![1]).toEqual([...CHARACTER_RULE_BASE_KINDS,'selections','subraces']);expect(mocks.full).not.toHaveBeenCalled()
 })
 it('does not satisfy a concurrent broader request with an incomplete pending result',async()=>{
  let finish!:(value:[])=>void;mocks.read.mockImplementationOnce(()=>new Promise<[]>(r=>finish=r)).mockResolvedValue([])
  const {characterRuleLibrary}=await import('./character-rule-library'),first=characterRuleLibrary('concurrent-owner',[])
  await vi.waitFor(()=>expect(mocks.read).toHaveBeenCalledTimes(1));const broader=characterRuleLibrary('concurrent-owner',['other']);finish([])
  await first;const result=await broader;expect(result.catalog.other).toEqual([]);expect(mocks.read).toHaveBeenCalledTimes(2)
 })
})
