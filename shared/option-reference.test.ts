import {describe,it,expect} from 'vitest'
import {selectedOption} from './option-reference'
describe('option identity recovery',()=>{
 const a={index:'a',name:'Shared',displayName:'Shared — Book A',aliases:['old-a']},b={index:'b',name:'Shared',displayName:'Shared — Book B'}
 it('prefers explicit IDs/aliases even when the label changed',()=>{expect(selectedOption([a,b],'old-a','Renamed')).toBe(a);expect(selectedOption([a,b],'missing','Shared — Book B')).toBeUndefined()})
 it('recovers full legacy labels and refuses ambiguous plain names or ambiguous aliases',()=>{expect(selectedOption([a,b],undefined,'Shared')).toBeUndefined();expect(selectedOption([a,b],undefined,'Shared — Book B')).toBe(b);expect(selectedOption([a,{...b,aliases:['old-a']}],'old-a','')).toBeUndefined()})
})
