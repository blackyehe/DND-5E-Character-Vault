import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {createRenderer,h,nextTick,reactive,ssrContextKey,type Component} from 'vue'
import MapCanvas from './MapCanvas.vue'
const renderer=createRenderer<object,object>({patchProp(){},insert(){},remove(){},createElement:()=>({}),createText:()=>({}),createComment:()=>({}),setText(){},setElementText(){},parentNode:()=>null,nextSibling:()=>null})
let bindings:any,stop:(()=>void)|undefined
beforeEach(()=>{
 vi.stubGlobal('window',Object.assign(new EventTarget(),{devicePixelRatio:2}))
 vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}})
 vi.stubGlobal('cancelAnimationFrame',vi.fn())
})
afterEach(()=>{stop?.();vi.unstubAllGlobals()})
it('preserves the camera, pin/region coordinate plane and hit positions across resolution swaps',async()=>{
 const resolution=vi.fn(),map={id:'map',title:'Map',width:3072,height:4096,pins:[],regions:[]}
 const props=reactive({map,imageUrl:'blob:overview',placing:false,selectedPin:'',drawerOpen:false,onResolution:resolution}),original=MapCanvas as any
 const subject={...original,setup(p:unknown,c:unknown){bindings=original.setup(p,c);return bindings},render:()=>null} as Component
 const app=renderer.createApp({setup:()=>()=>h(subject,props)});app.provide(ssrContextKey,{modules:new Set()});app.mount({});stop=()=>app.unmount()
 bindings.viewport.value={getBoundingClientRect:()=>({left:0,top:0,width:640,height:900})}
 bindings.plane.value={getBoundingClientRect:()=>({left:bindings.offset.value.x,top:bindings.offset.value.y,width:map.width*bindings.scale.value,height:map.height*bindings.scale.value})}
 bindings.measure();bindings.zoomAt(4,320,450);await nextTick()
 const style={...bindings.style.value},position=bindings.positionAt(400,600),offset={...bindings.offset.value},zoom=bindings.zoom.value
 expect(resolution).toHaveBeenLastCalledWith(4096)
 props.imageUrl='blob:original';await nextTick()
 expect(bindings.style.value).toEqual(style);expect(bindings.offset.value).toEqual(offset);expect(bindings.zoom.value).toBe(zoom)
 expect(bindings.positionAt(400,600)).toEqual(position)
 expect(bindings.style.value.width).toBe('3072px');expect(bindings.style.value.height).toBe('4096px')
})
