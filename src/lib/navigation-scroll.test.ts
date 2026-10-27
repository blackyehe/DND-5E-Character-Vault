import {afterEach,describe,expect,it,vi} from 'vitest'
import {revealNavigationTarget} from './navigation-scroll'
afterEach(()=>vi.unstubAllGlobals())
describe('explicit navigation scrolling',()=>{
  function setup(top:number){
    const scrollTo=vi.fn()
    vi.stubGlobal('window',{innerHeight:800,scrollY:500,scrollTo})
    const element={getBoundingClientRect:()=>({top})} as HTMLElement
    return {element,scrollTo}
  }
  it('leaves a visible heading and the document position untouched',()=>{
    const {element,scrollTo}=setup(160);revealNavigationTarget(element)
    expect(scrollTo).not.toHaveBeenCalled()
  })
  it('reveals a heading above sticky navigation without smooth scrolling',()=>{
    const {element,scrollTo}=setup(-100);revealNavigationTarget(element)
    expect(scrollTo).toHaveBeenCalledWith({top:312,behavior:'instant'})
  })
  it('reveals a heading below the viewport',()=>{
    const {element,scrollTo}=setup(900);revealNavigationTarget(element)
    expect(scrollTo).toHaveBeenCalledWith({top:1312,behavior:'instant'})
  })
  it('does nothing when an async panel has not mounted',()=>{
    const {scrollTo}=setup(0);revealNavigationTarget(null)
    expect(scrollTo).not.toHaveBeenCalled()
  })
})
