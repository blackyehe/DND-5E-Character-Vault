import {describe,expect,it,vi} from 'vitest'
import {createInitialPagePreparation,requestedPageFiles} from './page-preparation'
const map={compendium:['/assets/Compendium.js','/assets/common.css'],room:['/assets/Room.js','/assets/common.css'],notebook:['/assets/Notebook.js','/assets/common.css'],maps:['/assets/Maps.js'],character:['/assets/Sheet.js'],creator:['/assets/Creator.js'],workshop:['/assets/Workshop.js'],rooms:['/assets/Rooms.js'],join:['/assets/Join.js']}
describe('requested public page files',()=>{
  it('selects only the requested page and deduplicates shared dependencies',()=>{
    expect(requestedPageFiles({name:'room',query:{section:'notebook'}},map)).toEqual(['/assets/Room.js','/assets/common.css','/assets/Notebook.js'])
  })
  it.each([['maps','/assets/Maps.js'],['characters','/assets/Sheet.js']] as const)('selects the explicit %s section', (section,file)=>{
    expect(requestedPageFiles({name:'room',query:{section}},map)).toEqual(['/assets/Room.js','/assets/common.css',file])
  })
  it('supports a character target without guessing a default room role',()=>{
    expect(requestedPageFiles({name:'room',query:{character:'hero'}},map)).toContain('/assets/Sheet.js')
    expect(requestedPageFiles({name:'room',query:{}},map)).toEqual(['/assets/Room.js','/assets/common.css'])
  })
  it('does not let an unknown or malformed section select additional files',()=>{
    for(const section of ['party',['notebook'],null])expect(requestedPageFiles({name:'room',query:{section}},map)).toEqual(['/assets/Room.js','/assets/common.css'])
  })
  it('handles aliases and excludes eager, public-demo and missing routes',()=>{
    expect(requestedPageFiles({name:'room-champion',query:{}},map)).toEqual(['/assets/Sheet.js'])
    for(const name of ['dashboard','login','builder-preview','not-found','constructor',Symbol('room')])expect(requestedPageFiles({name,query:{}},map)).toEqual([])
  })
  it('accepts only fixed same-origin code/style paths, never API or external addresses',()=>{
    const files=['/assets/good.js','/assets/good.css','https://evil.example/a.js','//evil.example/a.js','/api/characters','/assets/../api/a.js','/assets/a.js?token=anything','/assets/a.json','javascript:alert(1)']
    expect(requestedPageFiles({name:'compendium',query:{}},{compendium:files})).toEqual(files.slice(0,2))
  })
})
describe('optional initial preparation',()=>{
  it('prepares only one initial destination, with no later sweep',()=>{
    const load=vi.fn(),read=vi.fn(()=>map),prepare=createInitialPagePreparation(read,load)
    prepare({name:'compendium',query:{}});prepare({name:'room',query:{section:'maps'}})
    expect(read).toHaveBeenCalledTimes(1);expect(load.mock.calls.map(c=>c[0])).toEqual(map.compendium)
  })
  it('contains missing/invalid metadata and individual hint failures',()=>{
    const fail=createInitialPagePreparation(()=>{throw Error('No build map')},()=>{throw Error('Should not run')})
    expect(()=>fail({name:'compendium',query:{}})).not.toThrow()
    const load=vi.fn().mockImplementationOnce(()=>{throw Error('Unsupported preload')}).mockImplementation(()=>{})
    expect(()=>createInitialPagePreparation(()=>map,load)({name:'compendium',query:{}})).not.toThrow();expect(load).toHaveBeenCalledTimes(2)
  })
})
