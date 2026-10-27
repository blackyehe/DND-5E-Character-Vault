import { describe,it,expect } from 'vitest'
import { combinedOrcbrew } from './orcbrew-export'
import { canonicalContent,inspectOrcbrew } from './orcbrew'
import { readEdn } from './edn'

describe('portable Orcbrew collection export',()=>{
  it('preserves colliding definitions, raw EDN, disabled flags, duplicate filenames and Unicode',()=>{
    const first='\uFEFF; original\n{:orcpub.dnd.e5/monsters {:same {:name "Élan" :option-pack "MM" :str 10 :unsupported #{:a :b} :special ##NaN}}} ; trailing comment\n#_ {:discard true}'
    const second='{"Nested pack" {:disabled? true :orcpub.dnd.e5/monsters {:same {:name "Élan" :option-pack "XMM" :str 12 :future #foo "data"}}}}'
    const output=combinedOrcbrew([{filename:'same.orcbrew',source:first},{filename:'same.orcbrew',source:second},{filename:':same.orcbrew',source:first}])
    expect(output).toContain(':unsupported #{:a :b} :special ##NaN')
    expect(output).toContain(':future #foo "data"')
    expect(Object.keys(readEdn(output) as object)).toEqual(['same.orcbrew','same.orcbrew (2)','File :same.orcbrew'])
    const entries=inspectOrcbrew(output).entries.monsters
    expect(entries).toHaveLength(3)
    expect(entries[1]!.disabled).toBe(true)
    for(const [i,input] of [first,second,first].entries()){
      const original=inspectOrcbrew(input).entries.monsters[0]!
      expect(entries[i]!.index).toBe(original.index)
      expect(canonicalContent(entries[i]!.details)).toBe(canonicalContent(original.details))
    }
  })
  it('fails the complete export rather than silently skipping an invalid saved file',()=>{
    expect(()=>combinedOrcbrew([])).toThrow('no saved Orcbrew')
    expect(()=>combinedOrcbrew([{filename:'broken.orcbrew',source:'{broken'}])).toThrow('broken.orcbrew')
  })
})
