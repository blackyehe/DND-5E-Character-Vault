import { describe,it,expect } from 'vitest'
import { browseIndex,browseRecord,queryBrowseIndex,type BrowseEntry,type BrowseKind } from './compendium-browse'
import { emptyItemFilters } from '../src/lib/magic-item-filters'

const request=(query='',page=1,facets:Record<string,string>={})=>({query,page,facets,items:emptyItemFilters()})
const rows=(count:number):BrowseEntry[]=>Array.from({length:count},(_,i)=>({index:`spell-${i}`,name:`Spell ${String(i).padStart(3,'0')}`,url:'',filterFacets:{level:[String(i%10)]},sourcePack:i===count-1?'Last book':'First book'}))
const index=(entries:BrowseEntry[],kind:BrowseKind)=>browseIndex(entries.map(e=>browseRecord(e,kind)),kind)
describe('whole-library Compendium pages',()=>{
  it('bounds every category to 25 and searches/filters entries beyond the first page',()=>{
    const library=index(rows(102),'spells'),first=queryBrowseIndex(library,'spells',request(),'r')
    expect(first.entries).toHaveLength(25);expect(first.pages).toBe(5)
    const last=queryBrowseIndex(library,'spells',request('Spell 101'),'r')
    expect(last.entries.map(e=>e.index)).toEqual(['spell-101'])
    expect(queryBrowseIndex(library,'spells',request('',1,{source:'Last book'}),'r').entries[0]?.index).toBe('spell-101')
    expect(first.commonFields.find(f=>f.key==='source')?.options.some(o=>o.value==='Last book')).toBe(true)
    expect(queryBrowseIndex(library,'spells',request('',999),'r')).toMatchObject({page:5,entries:expect.any(Array)})
    expect(queryBrowseIndex(library,'spells',request('no match',999),'r')).toMatchObject({page:1,pages:1,total:0,entries:[]})
  })
  it('never splits item versions at a page boundary and filters versions before grouping',()=>{
    const entries=rows(30).map((e,i)=>({...e,name:`Item ${String(i).padStart(3,'0')}`}))
    entries.push({...entries[24]!,index:'second-version',sourcePack:'Different book'})
    const library=index(entries,'magic-items'),first=queryBrowseIndex(library,'magic-items',request(),'r'),second=queryBrowseIndex(library,'magic-items',request('',2),'r')
    expect(first.total).toBe(30);expect(first.entries).toHaveLength(26)
    expect(first.entries.some(e=>e.index==='second-version')).toBe(true)
    expect(new Set(first.entries.map(e=>e.index)).intersection(new Set(second.entries.map(e=>e.index))).size).toBe(0)
    expect(queryBrowseIndex(library,'magic-items',request('',1,{source:'Different book'}),'r').entries.map(e=>e.index)).toEqual(['second-version'])
  })
  it('keeps monster families, typo aliases and source versions together',()=>{
    const entries:BrowseEntry[]=[{index:'vampire',name:'Vampire',url:'',sourcePack:'MM'},{index:'vampire-ua',name:'Vampire - UA',url:'',sourcePack:'UA'}]
    const library=index(entries,'monsters'),page=queryBrowseIndex(library,'monsters',request('vampire'),'r')
    expect(page.matchedEntries).toBe(2)
    expect(page.entries.map(e=>e.index)).toContain('vampire-ua')
    expect(queryBrowseIndex(library,'monsters',request('vampire',1,{source:'MM'}),'r').entries.map(e=>e.index)).toEqual(['vampire'])
  })
  it('preserves form plus extra-damage item filtering and tags outside the first page',()=>{
    const flame={index:'flame',name:'Flame Tongue Longsword',url:'',itemReference:true,itemDamageTypes:['fire'],sourcePack:'DMG',workshopItem:{name:'Flame Tongue Longsword',index:'longsword',qty:1,weight:3,equipped:false,notes:'',kind:'weapon' as const,rarity:'rare',requiresAttunement:true,weapon:{dice:'1d8',damageType:'slashing',category:'martial',ranged:false,range:'5 ft'},tags:['unusual-tag']}}
    const library=index([...rows(60),flame],'magic-items')
    const result=queryBrowseIndex(library,'magic-items',{...request(),items:{...emptyItemFilters(),weapon:'longsword',damage:'fire',rarity:'rare',attunement:'required'}},'r')
    expect(result.entries.map(e=>e.index)).toEqual(['flame'])
    expect(result.extraTags).toContain('unusual-tag')
  })
})
