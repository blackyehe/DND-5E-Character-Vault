import {afterEach,beforeEach,expect,it,vi} from 'vitest'
import {createRenderer,h,nextTick,reactive,ssrContextKey,type Component} from 'vue'
import RoomMaps from './RoomMaps.vue'
import {ApiError} from '../../lib/api'

const mocks=vi.hoisted(()=>({get:vi.fn(),open:vi.fn(),upgrade:vi.fn(),decode:vi.fn()}))
vi.mock('../../lib/api',async original=>({...await original<typeof import('../../lib/api')>(),api:{get:mocks.get}}))
vi.mock('../../lib/map-loading',()=>({loadRoomMap:mocks.open,loadMapImage:mocks.upgrade,decodedMapImageUrl:mocks.decode}))
vi.mock('../../composables/useVisiblePolling',()=>({useVisiblePolling:()=>{}}))
vi.mock('../../stores/auth',()=>({useAuthStore:()=>reactive({user:{id:'viewer'} as {id:string}|null})}))
const renderer=createRenderer<object,object>({patchProp(){},insert(){},remove(){},createElement:()=>({}),createText:()=>({}),createComment:()=>({}),setText(){},setElementText(){},parentNode:()=>null,nextSibling:()=>null})
const map={id:'map',title:'Map',audience:'room',characterIds:[],revision:1,updatedAt:'',width:3072,height:4096,bytes:2776932,pins:[],imageVariants:[{edge:1024,width:768,height:1024,bytes:178808},{edge:2048,width:1536,height:2048,bytes:703264}]}
const loaded={map,image:new Blob(['overview']),imageEdge:1024}
function deferred<T>(){let resolve!:(value:T)=>void,reject!:(reason:unknown)=>void;const promise=new Promise<T>((r,j)=>{resolve=r;reject=j});return{promise,resolve,reject}}
async function flush(){for(let n=0;n<8;n++)await Promise.resolve();await nextTick()}
let bindings:any,stop:(()=>void)|undefined
function mount(){
  const props=reactive({roomId:'room',previewCharacter:undefined as string|undefined,active:true}),original=RoomMaps as any
  const subject={...original,setup(props:unknown,context:unknown){bindings=original.setup(props,context);return bindings},render:()=>null} as Component
  const app=renderer.createApp({setup:()=>()=>h(subject,props)});app.provide(ssrContextKey,{modules:new Set()});app.mount({});stop=()=>app.unmount();return props
}
beforeEach(()=>{
  vi.useFakeTimers();for(const mock of Object.values(mocks))mock.mockReset()
  mocks.get.mockResolvedValue({maps:[map],role:'player',readOnly:false,characters:[]})
  mocks.open.mockImplementation(async(_details,_image,_signal,options)=>{options.onDetails(map);return loaded})
  mocks.decode.mockResolvedValue('blob:overview');mocks.upgrade.mockResolvedValue({image:new Blob(['original']),imageEdge:4096})
  vi.stubGlobal('window',Object.assign(new EventTarget(),{innerWidth:688,innerHeight:1040,devicePixelRatio:1,confirm:()=>true}))
  vi.stubGlobal('document',{visibilityState:'visible',body:{style:{}},activeElement:null})
  vi.spyOn(URL,'revokeObjectURL').mockImplementation(()=>{})
})
afterEach(()=>{stop?.();stop=undefined;vi.restoreAllMocks();vi.unstubAllGlobals();vi.useRealTimers()})

it('opens the metadata shell while image is pending and cancels a closed opening',async()=>{
  const pending=deferred<typeof loaded>()
  mocks.open.mockImplementation((_d,_i,_s,o)=>{o.onDetails(map);o.onProgress({received:50,total:100});return pending.promise})
  mount();await flush();const opening=bindings.openMap('map');await flush()
  expect(bindings.popupOpen.value).toBe(true);expect(bindings.selected.value.id).toBe('map');expect(bindings.imageUrl.value).toBe('')
  expect(bindings.loadingImageText.value).toContain('50%')
  const signal=mocks.open.mock.calls[0]![2] as AbortSignal
  bindings.closePopup();expect(signal.aborted).toBe(true);expect(bindings.selected.value).toBeNull()
  pending.resolve(loaded);await opening
  expect(bindings.popupOpen.value).toBe(false);expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:overview')
})
it('keeps the overview and camera selection while a sharper image decodes, then releases only the old URL',async()=>{
  mount();await flush();await bindings.openMap('map')
  bindings.selectedPin.value='pin';bindings.activeRegion.value='region'
  const decoded=deferred<string>();mocks.decode.mockReturnValueOnce(decoded.promise)
  const upgrade=bindings.upgradeImage(4096);await flush()
  expect(bindings.imageUrl.value).toBe('blob:overview');expect(bindings.upgradingImage.value).toBe(true)
  decoded.resolve('blob:original');await upgrade
  expect(bindings.imageUrl.value).toBe('blob:original');expect(bindings.imageEdge.value).toBe(4096)
  expect(bindings.selectedPin.value).toBe('pin');expect(bindings.activeRegion.value).toBe('region')
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:overview')
})
it('retains a usable overview after upgrade failure and clears it after access revocation',async()=>{
  mount();await flush();await bindings.openMap('map')
  mocks.upgrade.mockRejectedValueOnce(new ApiError(503,'unavailable'))
  await bindings.upgradeImage(4096)
  expect(bindings.imageUrl.value).toBe('blob:overview');expect(bindings.upgradeError.value).toContain('current view')
  bindings.requestImageResolution(800);expect(bindings.upgradeError.value).toBe('')
  mocks.upgrade.mockRejectedValueOnce(new ApiError(404,'access ended'))
  await bindings.upgradeImage(4096)
  expect(bindings.selected.value).toBeNull();expect(bindings.index.value).toBeNull();expect(bindings.imageUrl.value).toBe('')
})
it('ignores an old decode after a new map is selected',async()=>{
  mount();await flush()
  const old=deferred<string>();mocks.decode.mockReturnValueOnce(old.promise)
  const opening=bindings.openMap('map');await flush()
  const second={...map,id:'second'}
  mocks.open.mockImplementationOnce(async(_d,_i,_s,o)=>{o.onDetails(second);return{...loaded,map:second}})
  mocks.decode.mockResolvedValueOnce('blob:second');await bindings.openMap('second')
  old.resolve('blob:old');await opening
  expect(bindings.selected.value.id).toBe('second');expect(bindings.imageUrl.value).toBe('blob:second')
  expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:old')
})
it('cancels upgrades on close and clears all image state when preview scope changes',async()=>{
  const props=mount();await flush();await bindings.openMap('map')
  const pending=deferred<{image:Blob;imageEdge:number}>();mocks.upgrade.mockReturnValueOnce(pending.promise)
  const upgrade=bindings.upgradeImage(4096),signal=mocks.upgrade.mock.calls[0]![1] as AbortSignal
  bindings.closePopup();expect(signal.aborted).toBe(true);expect(bindings.imageUrl.value).toBe('blob:overview')
  props.previewCharacter='hero';await flush()
  expect(bindings.selected.value).toBeNull();expect(bindings.imageUrl.value).toBe('')
  pending.reject(new DOMException('Aborted','AbortError'));await upgrade
  expect(mocks.get).toHaveBeenLastCalledWith('/api/rooms/room/maps?previewCharacter=hero')
})
it('releases prepared images and prevents a stale decode after logout',async()=>{
  mount();await flush();const decode=deferred<string>();mocks.decode.mockReturnValueOnce(decode.promise)
  const opening=bindings.openMap('map');await flush()
  const signal=mocks.open.mock.calls[0]![2] as AbortSignal
  bindings.auth.user=null;await flush();expect(signal.aborted).toBe(true)
  decode.resolve('blob:logged-out');await opening
  expect(bindings.selected.value).toBeNull();expect(bindings.index.value).toBeNull()
  expect(bindings.imageUrl.value).toBe('');expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:logged-out')
})
