import { beforeEach,describe,it,expect,vi } from 'vitest'
import { useCompendiumBrowse } from './useCompendiumBrowse'
import { emptyItemFilters } from '../lib/magic-item-filters'
import type { BrowsePage } from '../../shared/compendium-browse'
const get=vi.hoisted(()=>vi.fn())
vi.mock('../lib/api',()=>({api:{get}}))
const request=(query='')=>({query,page:1,facets:{},items:emptyItemFilters()})
const response=(revision='r',name='First'):BrowsePage=>({revision,entries:[{index:name,name,url:''}],page:1,pageSize:25,pages:1,total:1,matchedEntries:1,totalEntries:1,categoryFields:[],commonFields:[],extraTags:[],unclassifiedMagicItems:0})
beforeEach(()=>get.mockReset())
describe('Compendium request cache',()=>{
  it('reuses recent pages and clears every cached category on account reset',async()=>{
    get.mockResolvedValue(response());const browse=useCompendiumBrowse()
    await browse.load('spells',request());await browse.load('spells',request())
    expect(get).toHaveBeenCalledOnce()
    browse.clear();expect(browse.response.value).toBeNull()
    await browse.load('spells',request());expect(get).toHaveBeenCalledTimes(2)
  })
  it('aborts stale requests and ignores their late results',async()=>{
    let finish!:(page:BrowsePage)=>void
    get.mockImplementationOnce(()=>new Promise<BrowsePage>(resolve=>{finish=resolve})).mockResolvedValueOnce(response('r','Second'))
    const browse=useCompendiumBrowse(),first=browse.load('spells',request('first'))
    await browse.load('spells',request('second'))
    expect(get.mock.calls[0]![1].signal.aborted).toBe(true)
    finish(response('r','First'));await first
    expect(browse.response.value?.entries[0]?.name).toBe('Second')
  })
  it('invalidates old cached pages when a newer server revision arrives',async()=>{
    get.mockResolvedValueOnce(response('r1')).mockResolvedValueOnce(response('r2')).mockResolvedValueOnce(response('r2'))
    const browse=useCompendiumBrowse()
    await browse.load('spells',request());await browse.load('monsters',request());await browse.load('spells',request())
    expect(get).toHaveBeenCalledTimes(3)
  })
})
