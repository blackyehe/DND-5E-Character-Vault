import { describe,it,expect,vi } from 'vitest'
import { enrichedMonsterEntries,enrichedStandardMonster } from './monster-enrichment'
import { monsterStatblock } from '../../shared/monster-statblock'
import { CustomContent } from '../models/CustomContent'

vi.mock('../models/CustomContent',()=>({CustomContent:{findOne:vi.fn()}}))
describe('tokens for previously enriched entries',()=>{
  it('includes the matching MM token for an SRD Aboleth',()=>{
    const data=enrichedStandardMonster({index:'aboleth',name:'Aboleth'},'monsters/aboleth')
    expect(monsterStatblock(data).extended?.token?.url).toBe('https://5e.tools/img/bestiary/tokens/MM/Aboleth.webp')
  })
  it('adds token metadata to old saved supplements without rewriting their contents',async()=>{
    const old={snapshot:'old',name:'Aboleth',source:'XMM',url:'https://5e.tools/bestiary.html#aboleth_xmm',mode:'rules-and-info',sections:[],extended:{info:{text:'Keep lore',source:'XMM',images:[]}}}
    const before=JSON.stringify(old)
    const select=vi.fn(()=>({lean:async()=>({data:{entries:{fixture:old}}})}))
    vi.mocked(CustomContent.findOne).mockReturnValue({select} as never)
    const [entry]=await enrichedMonsterEntries('owner',[{index:'fixture',name:'Aboleth'}])
    expect(monsterStatblock(entry).extended?.token?.url).toBe('https://5e.tools/img/bestiary/tokens/XMM/Aboleth.webp')
    expect(JSON.stringify(old)).toBe(before)
    expect(CustomContent.findOne).toHaveBeenCalledWith({userId:'owner',type:'monster-enrichment',sourceHash:'active'})
    expect(select).toHaveBeenCalledWith('data.entries.fixture')
  })
  it('requests only the distinct supplements being displayed',async()=>{
    const select=vi.fn(()=>({lean:async()=>null}))
    vi.mocked(CustomContent.findOne).mockReturnValue({select} as never)
    const entries=[{index:'homebrew-monsters-one',name:'One'},{index:'two',name:'Two'},{index:'two',name:'Two'}]
    expect(await enrichedMonsterEntries('owner',entries)).toEqual(entries)
    expect(select).toHaveBeenCalledWith('data.entries.homebrew-monsters-one data.entries.two')
  })
})
