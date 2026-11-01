import {beforeEach,expect,it,vi} from 'vitest'
import {gzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
const state=vi.hoisted(()=>({rows:[] as any[],find:vi.fn()}))
vi.mock('../models/CompendiumEntryCache',()=>({CompendiumEntryCache:{find:(filter:unknown)=>{state.find(filter);const q={select:()=>q,limit:()=>q,setOptions:()=>q,lean:async()=>state.rows};return q}}}))
import {cachedCompendiumSource} from './compendium-entry-source'
const index='homebrew-classes-one',revision='revision',row=(version:string,name:string,description='Complete rules')=>{const payload=gzipSync(JSON.stringify({index,name,homebrew:true,desc:[description]}));return {revision:version+':'+revision,payload,digest:createHash('sha256').update(payload).digest('hex')}}
beforeEach(()=>{state.rows=[];state.find.mockClear()})
it('preserves the foreground legacy winner and current owner/revision/expiry scope',async()=>{
 state.rows=[row('source-components-3-families','Current'),row('source-1','Legacy')]
 expect((await cachedCompendiumSource('owner','classes',index,revision,256*1024))?.name).toBe('Legacy')
 expect(state.find).toHaveBeenCalledWith({userId:'owner',kind:'classes',index,revision:{$in:['source-1:revision','source-components-3-families:revision']},expiresAt:{$gt:expect.any(Date)}})
})
it('does not substitute another cache winner when a legacy value exceeds the optional size budget',async()=>{
 state.rows=[row('source-1','Legacy','x'.repeat(300000)),row('source-components-3-families','Current')]
 await expect(cachedCompendiumSource('owner','classes',index,revision,256*1024)).rejects.toThrow('foreground read')
})
it('defers unverifiable legacy values without repairing or writing any cache',async()=>{
 state.rows=[{...row('source-1','Legacy'),digest:'invalid'},row('source-components-3-families','Current')]
 await expect(cachedCompendiumSource('owner','classes',index,revision,256*1024)).rejects.toThrow('foreground read')
})
it('can read a current-only cache and treats an absent cache as an optional miss',async()=>{
 expect(await cachedCompendiumSource('owner','classes',index,revision,256*1024)).toBeNull()
 state.rows=[row('source-components-3-families','Current')];expect((await cachedCompendiumSource('owner','classes',index,revision,256*1024))?.name).toBe('Current')
})
