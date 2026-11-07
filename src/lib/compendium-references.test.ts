import {beforeEach,describe,expect,it,vi} from 'vitest'
import {localIndexDigest} from '../../shared/local-compendium'
import {loadReadingSpellNames,spellReferences} from './compendium-references'
const get=vi.hoisted(()=>vi.fn());vi.mock('./api',()=>({api:{get}}))
const owner='111111111111111111111111'
async function snapshot(){
 const records=[{index:'shield',name:'Shield',url:''},{index:'homebrew-spells-'+ 'a'.repeat(32),name:'Northern Ward',sourcePack:'North',url:'',aliases:['old-ward'],contentKey:'ward'},{index:'another',name:'Southern Ward',sourcePack:'South',url:'',contentKey:'ward'}].map(entry=>({entry,search:entry.name.toLowerCase(),facts:{level:['1']}}))
 const payload=JSON.stringify({records,categoryFields:[],commonFields:[],extraTags:[],unclassifiedMagicItems:0})
 return {owner,kind:'spells',version:'local-compendium-1',revision:'b'.repeat(64),payload,digest:await localIndexDigest(payload)}
}
beforeEach(()=>get.mockReset())
describe('Compendium spell reference names',()=>{
 it('resolves verified metadata and unique legacy aliases without choosing ambiguous sources',async()=>{
  get.mockResolvedValue(await snapshot());const names=await loadReadingSpellNames(owner,new AbortController().signal)
  expect(names.get('shield')).toMatchObject({name:'Shield',source:'SRD 2014',level:1})
  expect(names.get('old-ward')?.name).toBe('Northern Ward');expect(names.has('ward')).toBe(false)
  expect(get.mock.calls[0]?.[0]).toBe('/api/compendium-browse/spells/local-index')
 })
 it('rejects a wrong owner or altered content rather than displaying stale/private names',async()=>{
  get.mockResolvedValue({...await snapshot(),owner:'other'});await expect(loadReadingSpellNames(owner,new AbortController().signal)).rejects.toThrow()
  get.mockResolvedValue({...await snapshot(),payload:'{}'});await expect(loadReadingSpellNames(owner,new AbortController().signal)).rejects.toThrow()
 })
 it('only treats known spell contexts or explicit imported spell IDs as references',()=>{
  expect(spellReferences(['shield'],'spellList')).toEqual(['shield'])
  expect(spellReferences(['homebrew-spells-'+ 'a'.repeat(32)],'unknown')).toHaveLength(1)
  expect(spellReferences(['Common','Sylvan'],'languages')).toBeNull()
  expect(spellReferences([{level:1,total:2}],'spells')).toBeNull()
 })
})
