import { afterEach, describe, expect, it, vi } from 'vitest'
import { vStableLoading } from './stableLoading'

function panel(height = 600, original = '') {
  const values = new Map<string,string>(original ? [['min-height',original]] : [])
  let measured = height
  const style = {
    getPropertyValue: (key:string) => values.get(key) ?? '',
    getPropertyPriority: () => original ? 'important' : '',
    setProperty: vi.fn((key:string,value:string) => {values.set(key,value)}),
    removeProperty: vi.fn((key:string) => values.delete(key)),
  }
  const element = {style,getBoundingClientRect:()=>({height:measured})} as unknown as HTMLElement
  return {element,style,values,resize:(height:number)=>{measured=height}}
}
function hook(name:'mounted'|'beforeUpdate'|'updated'|'beforeUnmount',element:HTMLElement,value:boolean) {
  const fn=vStableLoading[name] as (element:HTMLElement,binding:{value:boolean})=>void
  fn(element,{value})
}
afterEach(()=>vi.unstubAllGlobals())
describe('loading footprints',()=>{
  it('reserves the old height before content disappears and releases after success or failure',()=>{
    vi.stubGlobal('getComputedStyle',()=>({boxSizing:'border-box'}))
    const p=panel()
    hook('beforeUpdate',p.element,true)
    expect(p.values.get('min-height')).toBe('600px')
    p.resize(30)
    hook('updated',p.element,true)
    hook('beforeUpdate',p.element,true)
    expect(p.values.get('min-height')).toBe('600px')
    hook('updated',p.element,false)
    expect(p.values.has('min-height')).toBe(false)
  })
  it('restores an existing inline minimum and its priority on unmount',()=>{
    vi.stubGlobal('getComputedStyle',()=>({boxSizing:'border-box'}))
    const p=panel(600,'40rem')
    hook('mounted',p.element,true)
    hook('beforeUnmount',p.element,false)
    expect(p.style.setProperty).toHaveBeenLastCalledWith('min-height','40rem','important')
  })
  it('accounts for padding and borders on content-box panels',()=>{
    vi.stubGlobal('getComputedStyle',()=>({boxSizing:'content-box',paddingTop:'20px',paddingBottom:'20px',borderTopWidth:'1px',borderBottomWidth:'1px'}))
    const p=panel(600)
    hook('beforeUpdate',p.element,true)
    expect(p.values.get('min-height')).toBe('558px')
  })
  it('ignores hidden panels and measures a fresh height on a later request',()=>{
    vi.stubGlobal('getComputedStyle',()=>({boxSizing:'border-box'}))
    const p=panel(0)
    hook('beforeUpdate',p.element,true)
    expect(p.style.setProperty).not.toHaveBeenCalled()
    p.resize(400);hook('beforeUpdate',p.element,true);hook('updated',p.element,false)
    p.resize(700);hook('beforeUpdate',p.element,true)
    expect(p.values.get('min-height')).toBe('700px')
  })
})
