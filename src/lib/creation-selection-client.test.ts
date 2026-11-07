import {beforeEach,expect,it,vi} from 'vitest'
import {creationSelectionClient} from './creation-selection-client'
import {api} from './api'
vi.mock('./api',()=>({api:{get:vi.fn()}}))
const selections={revision:'a'.repeat(64),options:{classes:[],races:[],backgrounds:[],subraces:[],subclasses:[],feats:[],languages:[],spells:[]}},entry={index:'custom',name:'Class',url:'',homebrew:true as const,selectionOnly:true as const}
beforeEach(()=>vi.mocked(api.get).mockReset())
it('loads metadata alone, then coalesces exact revision-scoped selected definitions',async()=>{
 vi.mocked(api.get).mockResolvedValueOnce(selections).mockResolvedValueOnce({index:'custom',name:'Full definition',homebrew_traits:[{description:'Full rules'}]})
 const client=creationSelectionClient();await client.load();expect(api.get).toHaveBeenCalledOnce()
 const [a,b]=await Promise.all([client.definition('classes',entry),client.definition('classes',entry)]);expect(a).toEqual(b);expect(api.get).toHaveBeenCalledTimes(2);expect(vi.mocked(api.get).mock.calls[1]![0]).toBe('/api/content/creation-definitions/classes/custom?revision='+selections.revision)
})
it('does not accept a late definition after reset or use it for another account',async()=>{
 let finish!:(v:unknown)=>void;vi.mocked(api.get).mockResolvedValueOnce(selections).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
 const client=creationSelectionClient();await client.load();const result=client.definition('classes',entry);client.reset();finish({index:'custom'});await expect(result).rejects.toThrow('changed');await expect(client.definition('classes',entry)).rejects.toThrow('Reload')
})
it('propagates stale revision/access errors and allows retry without a full-catalogue fallback',async()=>{
 const error=Object.assign(Error('changed'),{status:409});vi.mocked(api.get).mockResolvedValueOnce(selections).mockRejectedValueOnce(error).mockResolvedValueOnce({index:'custom'})
 const client=creationSelectionClient();await client.load();await expect(client.definition('classes',entry)).rejects.toBe(error);expect((await client.definition('classes',entry)).index).toBe('custom');expect(vi.mocked(api.get).mock.calls.some(([p])=>p==='/api/content/creation-options')).toBe(false)
})
it('rejects malformed list bodies before exposing incomplete choices',async()=>{
 vi.mocked(api.get).mockResolvedValueOnce({...selections,options:{...selections.options,classes:[{index:'incomplete'}]}})
 await expect(creationSelectionClient().load()).rejects.toThrow('could not be read')
})
it('rejects a pending definition if the signed-in owner changes',async()=>{
 let owner='first',finish!:(value:unknown)=>void;vi.mocked(api.get).mockResolvedValueOnce(selections).mockImplementationOnce(()=>new Promise(resolve=>{finish=resolve}))
 const client=creationSelectionClient(()=>owner);await client.load();const task=client.definition('classes',entry);owner='second';finish({index:'custom'});await expect(task).rejects.toThrow('changed')
})
