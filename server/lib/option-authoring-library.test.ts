import {beforeEach,expect,it,vi} from 'vitest'
import {newOptionDraft} from '../../shared/option-workshop'
import {OPTION_KINDS} from '../../shared/option-kinds'
import {inspectOrcbrew,sourceHash} from './orcbrew'
import {optionRecord} from './option-workshop'
import {placeOptionEntry} from './workshop-pack'
import {optionAuthoringLibrary} from './option-authoring-library'
const mocks=vi.hoisted(()=>({enabled:vi.fn(),metadata:vi.fn(),read:vi.fn(),legacy:vi.fn()}))
vi.mock('./compendium-prepared',()=>({preparedReaderEnabled:mocks.enabled}))
vi.mock('./compendium-components',()=>({componentMetadata:mocks.metadata,componentContext:(p:any)=>p.sourceHash?`${p._id}:${p.sourceHash}:${p.updatedAt}`:null,readComponentCatalogues:mocks.read}))
vi.mock('./workshop-library',()=>({workshopLibrary:mocks.legacy}))
const draft=newOptionDraft('feats');draft.body.name='Zhaerin Contractor';draft.body.description='Complete editable text';draft.benefits=[{type:'spell-attack-bonus',value:1},{type:'spell-dc-bonus',value:1}]
const source=placeOptionEntry(undefined,'feats','feat',optionRecord(draft,2,['previous-index']),draft.id),hash=sourceHash(source)
const metadata=[{_id:'pack',sourceHash:hash,updatedAt:'now',data:{filename:'Blacky.orcbrew'}}],pack={id:'pack',filename:'Blacky.orcbrew',includeDisabled:false,parsed:inspectOrcbrew(source)},docs=[{...metadata[0],data:{filename:'Blacky.orcbrew',source}}]
beforeEach(()=>{vi.clearAllMocks();mocks.enabled.mockReturnValue(true);mocks.metadata.mockResolvedValue(metadata);mocks.read.mockResolvedValue([pack]);mocks.legacy.mockResolvedValue({packs:[pack],docs,warnings:['legacy warning']})})
it('loads complete authoring options using only option categories and retains stable identity and hashes',async()=>{
 const result=await optionAuthoringLibrary('owner');expect(mocks.read).toHaveBeenCalledWith('owner',OPTION_KINDS,metadata,false,expect.any(Number));expect(mocks.legacy).not.toHaveBeenCalled();expect(result.lib.docs).toBeUndefined();expect(result.lib.hashes.get('pack')).toBe(hash);expect(result.rows[0]!.draft).toMatchObject(draft);expect((result.rows[0]!.entry.details as Record<string,unknown>)[':codex/previous-indexes']).toContain('previous-index')
})
it.each(['off','missing','error','changed','unverified'])('falls back to complete source definitions when prepared data is %s',async condition=>{
 if(condition==='off')mocks.enabled.mockReturnValue(false)
 if(condition==='missing')mocks.read.mockResolvedValue(null)
 if(condition==='error')mocks.read.mockRejectedValue(Error('Storage failure'))
 if(condition==='changed')mocks.metadata.mockResolvedValueOnce(metadata).mockResolvedValueOnce([{...metadata[0],sourceHash:'changed'}])
 if(condition==='unverified')mocks.metadata.mockResolvedValue([{...metadata[0],sourceHash:undefined}])
 const result=await optionAuthoringLibrary('owner');expect(mocks.legacy).toHaveBeenCalledWith('owner');expect(result.lib.docs).toBe(docs);expect(result.lib.hashes.get('pack')).toBe(hash);expect(result.rows[0]!.draft.benefits).toEqual(draft.benefits);expect(result.lib.warnings).toEqual(['legacy warning'])
})
