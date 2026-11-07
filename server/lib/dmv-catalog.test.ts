import {beforeEach,expect,it,vi} from 'vitest'
import {inspectOrcbrew,sourceHash,type CatalogPack} from './orcbrew'
const f=vi.hoisted(()=>({env:{COMPENDIUM_READER:'prepared',COMPENDIUM_PREPARED_USERS:'owner'},metadata:vi.fn(),read:vi.fn(),find:vi.fn()}))
vi.mock('../env',()=>({env:f.env}))
vi.mock('../models/CustomContent',()=>({CustomContent:{find:f.find}}))
vi.mock('./compendium-components',()=>({componentMetadata:f.metadata,readComponentCatalogues:f.read,componentContext:(p:any)=>JSON.stringify([p._id,p.userId,p.sourceHash,p.updatedAt,p.data.filename,p.data.includeDisabled])}))
const source='{:orcpub.dnd.e5/feats {:test {:name "Preserved feat" :description "Original rules"}}}',pack={_id:'one',userId:'owner',sourceHash:sourceHash(source),updatedAt:new Date(1),data:{filename:'fixture.orcbrew',source}},parsed:CatalogPack={id:pack._id,filename:pack.data.filename,parsed:inspectOrcbrew(source)}
beforeEach(()=>{vi.resetModules();vi.clearAllMocks();f.env.COMPENDIUM_READER='prepared';f.env.COMPENDIUM_PREPARED_USERS='owner';f.metadata.mockResolvedValue([pack]);f.read.mockResolvedValue([parsed]);f.find.mockReturnValue({lean:async()=>[pack]})})

it('reads the complete required catalogue without source queries or inline repairs and rechecks current identity',async()=>{
 const {dmvImportCatalog}=await import('./dmv-catalog'),result=await dmvImportCatalog('owner')
 expect(result.reader).toBe('prepared');expect(result.catalog.feats[0]?.name).toBe('Preserved feat');expect(f.find).not.toHaveBeenCalled();expect(f.metadata).toHaveBeenCalledTimes(2)
 expect(f.metadata.mock.calls.every(c=>c[0]==='owner')).toBe(true)
 expect(f.read).toHaveBeenCalledWith('owner',['classes','subclasses','races','subraces','backgrounds','feats','spells'],[pack],false,expect.any(Number))
})
it.each([['legacy','owner'],['prepared','other']])('preserves the original reader for %s / %s',async(mode,user)=>{
 f.env.COMPENDIUM_READER=mode;const {dmvImportCatalog}=await import('./dmv-catalog'),r=await dmvImportCatalog(user)
 expect(r.reader).toBe('legacy');expect(f.metadata).not.toHaveBeenCalled();expect(f.find).toHaveBeenCalledWith({userId:user,type:'orcbrew'})
})
it('uses all current original sources when a prepared catalogue is missing or corrupt',async()=>{
 f.read.mockResolvedValue(null);const {dmvImportCatalog}=await import('./dmv-catalog'),r=await dmvImportCatalog('owner');expect(r.reader).toBe('legacy');expect(r.catalog.feats[0]?.name).toBe('Preserved feat');expect(f.find).toHaveBeenCalledTimes(1)
})
it('falls back after a metadata read fails without publishing or trusting stale material',async()=>{
 f.metadata.mockRejectedValue(Error('Synthetic timeout'));const {dmvImportCatalog}=await import('./dmv-catalog');expect((await dmvImportCatalog('owner')).reader).toBe('legacy');expect(f.find).toHaveBeenCalledTimes(1)
})
it.each(['replacement','deletion','sharing-option'])('rejects a racing %s and reads the latest source set',async kind=>{
 f.metadata.mockResolvedValueOnce([pack]).mockResolvedValueOnce(kind==='deletion'?[]:[{...pack,...kind==='replacement'?{sourceHash:'changed'}:{data:{...pack.data,includeDisabled:true}}}]);f.find.mockReturnValue({lean:async()=>[]})
 const {dmvImportCatalog}=await import('./dmv-catalog'),r=await dmvImportCatalog('owner');expect(r.reader).toBe('legacy');expect(r.catalog.feats).toEqual([])
})
it('keeps the legacy behavior of skipping one broken source while preserving valid definitions',async()=>{
 f.read.mockResolvedValue(null);f.find.mockReturnValue({lean:async()=>[{...pack,_id:'broken',data:{filename:'broken',sourceEncoding:'unknown',source:'invalid'}},pack]});const {dmvImportCatalog}=await import('./dmv-catalog'),r=await dmvImportCatalog('owner');expect(r.catalog.feats).toHaveLength(1)
})
it('produces identical definition identifiers, provenance and rules to the original reader',async()=>{
 const {dmvImportCatalog}=await import('./dmv-catalog'),prepared=await dmvImportCatalog('owner');f.read.mockResolvedValue(null);const legacy=await dmvImportCatalog('owner');expect(prepared.catalog).toEqual(legacy.catalog)
})
