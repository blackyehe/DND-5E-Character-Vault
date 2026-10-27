import { describe,it,expect } from 'vitest'
import { fiveToolsMonsterToken,readMonsterToken } from './monster-token'
import { readMonsterExtensions } from './monster-extensions'

describe('source-qualified monster tokens',()=>{
  it('follows source filenames, removing quotes and accents and encoding path characters',()=>{
    expect(fiveToolsMonsterToken({name:'"Rothé" / Æther',source:'XMM',hasToken:true})?.url).toBe('https://5e.tools/img/bestiary/tokens/XMM/Rothe%20%2F%20AEther.webp')
    expect(fiveToolsMonsterToken({name:'Aboleth',source:'MM',hasToken:true})?.url).toContain('/MM/Aboleth.webp')
    expect(fiveToolsMonsterToken({name:'Aboleth',source:'XMM',hasToken:true})?.url).toContain('/XMM/Aboleth.webp')
    expect(fiveToolsMonsterToken({name:'No Token',source:'MM'})).toBeUndefined()
  })
  it('uses explicit overrides before implicit names and retains attribution',()=>{
    expect(fiveToolsMonsterToken({name:'Variant',source:'MM',hasToken:true,token:{name:'Original',source:'VGM'},tokenCredit:'Artist'})).toEqual({url:'https://5e.tools/img/bestiary/tokens/VGM/Original.webp',credit:'Artist'})
    expect(fiveToolsMonsterToken({tokenUrl:'https://example.com/token.png',token:{name:'Unused',source:'MM'}})?.url).toBe('https://example.com/token.png')
    expect(fiveToolsMonsterToken({tokenHref:{type:'internal',path:'bestiary/tokens/MM/Original.webp'}})?.url).toBe('https://5e.tools/img/bestiary/tokens/MM/Original.webp')
  })
  it('uses the retained base token for generated forms without inventing one',()=>{
    expect(fiveToolsMonsterToken({name:'Spirit (Form)',source:'TCE',_versionBase_name:'Spirit',_versionBase_source:'TCE',_versionBase_hasToken:true})?.url).toBe('https://5e.tools/img/bestiary/tokens/TCE/Spirit.webp')
  })
  it('reads existing immutable pack provenance without changing it',()=>{
    const raw={provenance:{format:'5etools',original:JSON.stringify({monster:{name:'Aboleth',source:'MM',hasToken:true}})}}
    const before=JSON.stringify(raw)
    expect(readMonsterExtensions(raw).token?.url).toContain('/MM/Aboleth.webp')
    expect(JSON.stringify(raw)).toBe(before)
    expect(readMonsterExtensions({provenance:{format:'5etools',original:'bad'}}).token).toBeUndefined()
  })
  it('rejects executable and credential-bearing image links',()=>{
    for(const url of ['javascript:alert(1)','data:image/svg+xml,test','https://user:password@example.com/a'])expect(readMonsterToken({url})).toBeUndefined()
  })
})
