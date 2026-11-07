import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import indexes from '../../server/data/srd-2014-compendium-index.json'
import equipment from '../../server/data/srd-2014-equipment.json'
const kinds=['classes','races','backgrounds','languages','equipment'] as const
const refs=(rows:{index:string;name:string;url:string}[])=>rows.map(({index,name,url})=>({index,name,url}))
beforeEach(()=>{vi.resetModules()})
afterEach(()=>{vi.unstubAllGlobals()})
it('keeps every public selection identical to its pinned source with no full definitions in the asset',async()=>{
 const {default:lists}=await import('./srd-selection-lists.json')
 for(const kind of kinds){
  const expected=kind==='equipment'?refs(equipment):refs(indexes[kind]).sort((a,b)=>a.index.localeCompare(b.index,'en'))
  expect(lists[kind]).toEqual(expected)
  expect(lists[kind].every(row=>Object.keys(row).sort().join(',')==='index,name,url')).toBe(true)
 }
})
it('opens all five selection lists without SRD API requests',async()=>{
 const {default:data}=await import('./srd-selection-lists.json'),fetch=vi.fn(async()=>new Response(JSON.stringify(data)));vi.stubGlobal('fetch',fetch)
 const {srd}=await import('./srd')
 const lists=await Promise.all(kinds.map(kind=>srd[kind]()))
 expect(lists.map(rows=>rows.length)).toEqual([12,9,1,16,237]);expect(fetch).toHaveBeenCalledOnce()
})
it('keeps complete rules on the existing definition endpoint',async()=>{
 const value={index:'fighter',name:'Fighter',hit_die:10,fullRules:['Unchanged definition']},fetch=vi.fn(async(_path:string)=>new Response(JSON.stringify(value)))
 vi.stubGlobal('fetch',fetch);const {srd}=await import('./srd')
 expect(await srd.class('fighter')).toEqual(value);expect(fetch.mock.calls[0]![0]).toBe('/api/2014/classes/fighter')
})
it('falls back to the existing API if the optional list asset cannot load',async()=>{
 const value={index:'fighter',name:'Fighter',url:'/api/2014/classes/fighter'},fetch=vi.fn(async(path:string)=>path.startsWith('/api/')?new Response(JSON.stringify({count:1,results:[value]})):new Response('',{status:503}))
 vi.stubGlobal('fetch',fetch);const {srd}=await import('./srd')
 expect(await srd.classes()).toEqual([value]);expect(fetch).toHaveBeenCalledTimes(2);expect(fetch.mock.calls[1]![0]).toBe('/api/2014/classes')
})
