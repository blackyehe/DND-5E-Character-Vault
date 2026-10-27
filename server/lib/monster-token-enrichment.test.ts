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
    vi.mocked(CustomContent.findOne).mockReturnValue({select:()=>({lean:async()=>({data:{entries:{fixture:old}}})})} as never)
    const [entry]=await enrichedMonsterEntries('owner',[{index:'fixture',name:'Aboleth'}])
    expect(monsterStatblock(entry).extended?.token?.url).toBe('https://5e.tools/img/bestiary/tokens/XMM/Aboleth.webp')
    expect(JSON.stringify(old)).toBe(before)
  })
})
