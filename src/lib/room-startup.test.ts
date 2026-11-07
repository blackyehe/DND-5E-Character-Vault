import {expect,it} from 'vitest'
import {previewSection} from './room-startup'
it.each(['notebook','maps'] as const)('keeps %s open when entering and leaving player preview',section=>{
 expect(previewSection(section,true)).toBe(section);expect(previewSection(section,false)).toBe(section)
})
it('keeps the existing dashboard/sheet transitions where a player sheet is requested',()=>{
 expect(previewSection('party',true)).toBe('characters');expect(previewSection('characters',true)).toBe('characters');expect(previewSection('characters',false)).toBe('party')
})
