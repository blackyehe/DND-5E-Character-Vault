import {expect, it} from 'vitest'
import {fittedMapImageEdge, mapImageEdge, mapImagePath} from './map-image-resolution'
import type {MapSummary} from '../../shared/room-maps'
const map: MapSummary = {id:'map',title:'Map',audience:'room',characterIds:[],revision:1,updatedAt:'',width:3072,height:4096,bytes:2776932,imageVariants:[{edge:1024,width:768,height:1024,bytes:178808},{edge:2048,width:1536,height:2048,bytes:703264}]}
it('chooses sufficient fitted resolution for DPR, zoom and legacy maps without altering world dimensions',()=>{
  const before = structuredClone(map)
  for (const [dpr,zoom,expected] of [[1,1,1024],[2,1,2048],[1,2,2048],[2,2,4096],[1,4,4096]]) {
    expect(mapImageEdge(map,fittedMapImageEdge(map,{width:640,height:900,dpr:dpr!},zoom))).toBe(expected)
  }
  expect(mapImageEdge({...map,imageVariants:[]},800)).toBe(4096)
  expect(map).toEqual(before)
})
it('does not choose an oversized derivative and handles tall or small screens',()=>{
  expect(mapImageEdge({...map,imageVariants:[{edge:1024,width:768,height:1024,bytes:map.bytes+1}]},800)).toBe(4096)
  expect(mapImageEdge(map,fittedMapImageEdge(map,{width:390,height:650,dpr:2}))).toBe(1024)
  expect(mapImageEdge(map,fittedMapImageEdge(map,{width:2400,height:2400,dpr:2}))).toBe(4096)
})
it('preserves player preview query scope when selecting an image variant',()=>{
  expect(mapImagePath('/api/maps/map/image?previewCharacter=hero',1024)).toBe('/api/maps/map/image?previewCharacter=hero&size=1024')
  expect(mapImagePath('/api/maps/map/image?previewCharacter=hero')).toBe('/api/maps/map/image?previewCharacter=hero')
})
