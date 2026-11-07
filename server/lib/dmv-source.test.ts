import {afterEach,expect,it,vi} from 'vitest'
import {fetchDmvCharacter} from './dmv-import'
afterEach(()=>vi.unstubAllGlobals())
it.each([[403,502],[404,422],[503,502]])('reports upstream %i separately from the import status %i without reflecting its body',async(sourceStatus,status)=>{
 const fetcher=vi.fn(async()=>new Response('Private upstream diagnostic',{status:sourceStatus}));vi.stubGlobal('fetch',fetcher)
 const error=await fetchDmvCharacter('https://www.dungeonmastersvault.com/pages/dnd/5e/characters/123').catch(e=>e)
 expect(error).toMatchObject({status,sourceStatus});expect(error.message).not.toContain('Private upstream diagnostic');if(sourceStatus===403)expect(error.message).toContain('refused this server')
 expect(fetcher).toHaveBeenCalledWith('https://www.dungeonmastersvault.com/dnd/5e/characters/123',expect.objectContaining({headers:{Accept:'application/edn, application/json'},redirect:'error'}))
})
it('keeps named public character source bytes and canonical source URL on successful fetch',async()=>{
 const source='\uFEFF{:orcpub.entity/values {:character-name "Fixture"}}\r\n';vi.stubGlobal('fetch',vi.fn(async()=>new Response(source,{headers:{'content-type':'application/edn'}})))
 expect(await fetchDmvCharacter('http://dungeonmastersvault.com/dnd/5e/characters/123')).toEqual({source,sourceUrl:'https://www.dungeonmastersvault.com/pages/dnd/5e/characters/123'})
})
it('rejects unsafe URLs before requesting and keeps transport failures generic',async()=>{
 const fetcher=vi.fn(async()=>{throw Error('Internal transport detail')});vi.stubGlobal('fetch',fetcher)
 await expect(fetchDmvCharacter('http://127.0.0.1/private')).rejects.toMatchObject({status:400});expect(fetcher).not.toHaveBeenCalled()
 await expect(fetchDmvCharacter('https://www.dungeonmastersvault.com/pages/dnd/5e/characters/123')).rejects.toMatchObject({status:502,message:'Dungeon Master’s Vault could not be reached. Try again, or upload character data instead.'})
})
