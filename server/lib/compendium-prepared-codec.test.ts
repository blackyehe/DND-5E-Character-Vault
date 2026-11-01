import {expect,it} from 'vitest'
import {decodePrepared,encodePrepared,encodePreparedAsync} from './compendium-prepared-codec'
it.each([[],{name:'Unicode \u00e9 \ud83d\udde1',rules:['Preserve the complete source',1,null]},Array.from({length:500},(_,i)=>({index:i,description:'Full rules '.repeat(50)}))])('background compression preserves the exact existing format',async value=>{
 const sync=encodePrepared(value,1024*1024),async=await encodePreparedAsync(value,1024*1024)
 expect(async).toEqual(sync);expect(decodePrepared(async,1024*1024)).toEqual(value)
})
it('rejects oversized background objects before compression',async()=>{await expect(encodePreparedAsync({description:'x'.repeat(1000)},100)).rejects.toThrow('supported size')})
