import {reactive} from 'vue'
import {BROWSE_KINDS,type BrowseKind} from '../../shared/compendium-kinds'
import {foregroundBusy,onForegroundWork} from './foreground-work'
import {detailPreloadWaiting,onDetailPreloadActivity} from './compendium-detail-preloader'
import {cancelLocalPreparation,checkSavedCompendium,invalidateLocalCompendium,localCompendiumEnabled,localCompendiumState,onLocalCompendiumChange,saveLocalCompendium,setLocalCategoryState} from './local-compendium-client'

interface PreparationDependencies {
 check:(owner:string,kind:BrowseKind,signal:AbortSignal)=>Promise<boolean>
 save:(owner:string,kind:BrowseKind,signal:AbortSignal)=>Promise<void>
 state:(owner:string,kind:BrowseKind)=>string
 mark:(owner:string,kind:BrowseKind,state:'downloading'|'checking'|'unavailable')=>void
 cancel:()=>void
 lock:(owner:string,run:()=>Promise<void>)=>Promise<boolean>
}
export type PreparationPauseReason=''|'foreground'|'room'|'hidden'|'offline'|'login'|'details'
export const preparationPauseMessages={
 foreground:'Waiting for the current website request to finish. Checks resume automatically when the website is idle.',
 room:'Paused during this game room session. Checks resume automatically after you leave the room.',
 hidden:'Paused while this tab is hidden. Checks resume automatically when you return to this tab.',
 offline:'Paused while offline. Checks resume automatically when your connection returns.',
 login:'Waiting for sign-in. Checks start automatically after you sign in.',
 details:'Preparing visible entry details first. Search-index checks resume automatically afterward.',
} as const
export function compendiumPauseReason(path:string,hidden:boolean,online:boolean):PreparationPauseReason{
 if(!online)return 'offline'
 if(hidden)return 'hidden'
 if(path.startsWith('/rooms/'))return 'room'
 if(path==='/login')return 'login'
 return ''
}
export const preparationStatus=reactive({owner:'',phase:'idle',pauseReason:'' as PreparationPauseReason,kind:'' as BrowseKind|'',completed:0,total:BROWSE_KINDS.length,message:''})

/** Single, abortable idle queue. Exported for deterministic timing tests. */
export class CompendiumPreparation {
 private owner=''
 private paused=true
 private active?:AbortController
 private timer?:ReturnType<typeof setTimeout>
 private due=new Map<BrowseKind,number>()
 private failures=new Map<BrowseKind,number>()
 private priority?:BrowseKind
 private deps:PreparationDependencies
 constructor(deps:PreparationDependencies){this.deps=deps}
 configure(owner:string,paused:boolean,reason:PreparationPauseReason='foreground'){
  if(owner!==this.owner){this.pause();this.owner=owner;this.due.clear();this.failures.clear();this.priority=undefined}
  this.paused=paused||!owner
  preparationStatus.owner=owner
  preparationStatus.pauseReason=this.paused&&owner?reason||'foreground':''
  if(this.paused){this.pause();preparationStatus.phase=owner?'paused':'idle'}else{
   if(!this.active)preparationStatus.phase=preparationStatus.completed===BROWSE_KINDS.length?'ready':'queued'
   this.schedule(1500)
  }
 }
 private pause(){clearTimeout(this.timer);this.timer=undefined;this.active?.abort();this.deps.cancel()}
 prioritize(kind:BrowseKind){this.priority=kind;this.due.set(kind,0);if(!this.paused)this.schedule(900)}
 refresh(){this.due.clear();this.failures.clear();if(!this.paused)this.schedule(1500)}
 private schedule(delay:number){if(this.timer||this.active||this.paused)return;this.timer=setTimeout(()=>{this.timer=undefined;void this.run()},delay)}
 private async run(){
  if(this.paused||this.active)return
  const now=Date.now(),owner=this.owner
  const ordered=this.priority?[this.priority,...BROWSE_KINDS.filter(k=>k!==this.priority)]:[...BROWSE_KINDS]
  const kind=ordered.find(k=>(this.due.get(k)??0)<=now&&this.deps.state(owner,k)!=='unavailable')
  if(!kind){this.schedule(60000);return}
  const controller=new AbortController();this.active=controller
  preparationStatus.phase='checking';preparationStatus.kind=kind
  try{
   const acquired=await this.deps.lock(owner,async()=>{
    if(controller.signal.aborted)return
    if(!await this.deps.check(owner,kind,controller.signal)){
     if(controller.signal.aborted)return
     this.deps.mark(owner,kind,'downloading');preparationStatus.phase='downloading'
     await this.deps.save(owner,kind,controller.signal)
    }
   })
   if(!controller.signal.aborted&&owner===this.owner){
    this.due.set(kind,Date.now()+(acquired?60000:5000));this.failures.delete(kind)
    if(acquired&&!this.failures.size)preparationStatus.message=''
   }
  }catch{
   if(!controller.signal.aborted&&owner===this.owner){
    const failures=(this.failures.get(kind)??0)+1;this.failures.set(kind,failures)
    this.due.set(kind,Date.now()+Math.min(600000,30000*2**(failures-1)))
    this.deps.mark(owner,kind,'checking')
    preparationStatus.message='Some categories could not be prepared. Server browsing remains available; preparation will retry.'
   }
  }finally{
   if(controller.signal.aborted&&owner===this.owner&&this.deps.state(owner,kind)==='downloading')this.deps.mark(owner,kind,'checking')
   this.active=undefined
   preparationStatus.completed=BROWSE_KINDS.filter(k=>this.deps.state(this.owner,k)==='saved').length
   preparationStatus.phase=this.paused?'paused':preparationStatus.completed===BROWSE_KINDS.length?'ready':'queued'
   this.schedule(1000)
  }
 }
 dispose(){this.paused=true;this.pause()}
}

const service=new CompendiumPreparation({
 check:checkSavedCompendium,save:saveLocalCompendium,state:localCompendiumState,mark:setLocalCategoryState,cancel:cancelLocalPreparation,
 lock:async(owner,run)=>{
  // Without cross-tab locks, retain server browsing rather than duplicate a full
  // export in every tab. Supported desktop browsers implement Web Locks.
  if(!navigator.locks){preparationStatus.message='Automatic preparation is unavailable in this browser. Server browsing remains available.';return false}
  return navigator.locks.request(`codex-compendium:${owner}`,{ifAvailable:true},async lock=>{if(!lock)return false;await run();return true})
 },
})
let activeOwner='',blocked=true,blockedReason:PreparationPauseReason=''
function configure(){const busy=foregroundBusy(),details=detailPreloadWaiting();service.configure(activeOwner,blocked||busy||details,blocked?blockedReason:busy?'foreground':details?'details':'')}
onForegroundWork(configure)
onDetailPreloadActivity(configure)
onLocalCompendiumChange(()=>{
 preparationStatus.completed=activeOwner?BROWSE_KINDS.filter(k=>localCompendiumState(activeOwner,k)==='saved').length:0
 // A cross-tab update is checked on the next pass; don't interrupt foreground queries.
})
export function configureCompendiumPreparation(owner:string|undefined,paused:boolean,reason:PreparationPauseReason=''){activeOwner=localCompendiumEnabled?owner??'':'';blocked=paused;blockedReason=reason;configure()}
export function prioritizeCompendium(kind:BrowseKind){service.prioritize(kind)}
export function refreshCompendiumPreparation(){invalidateLocalCompendium();service.refresh()}
