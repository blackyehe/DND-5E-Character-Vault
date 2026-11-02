import type {BrowseKind} from '../../shared/compendium-browse'
import {COMPENDIUM_PRELOAD_LIMITS as limits} from '../../shared/compendium-details'

interface Dependencies {preload:(owner:string,kind:BrowseKind,indexes:string[],signal:AbortSignal,budget:number)=>Promise<number|undefined>}
const waiting=new Set<symbol>(),listeners=new Set<()=>void>()
export const detailPreloadWaiting=()=>waiting.size>0
export function onDetailPreloadActivity(listener:()=>void){listeners.add(listener);return ()=>{listeners.delete(listener)}}
/** A single visible-page queue. No global timer, network or browser side effects
 * until its owning view supplies a page and permits idle work. */
export class CompendiumDetailPreloader {
 private owner=''
 private kind:BrowseKind='spells'
 private indexes:string[]=[]
 private seen=new Set<string>()
 private bytes=0
 private failures=0
 private attempts=0
 private generation=0
 private paused=true
 private disposed=false
 private timer?:ReturnType<typeof setTimeout>
 private intentTimer?:ReturnType<typeof setTimeout>
 private intentIndex=''
 private active?:AbortController
 private token=Symbol('visible-page')
 private deps:Dependencies
 constructor(deps:Dependencies){this.deps=deps}
 setPage(owner:string,kind:BrowseKind,indexes:string[]){
  this.clear();this.owner=owner;this.kind=kind
  this.indexes=[...new Set(indexes)].filter(i=>i&&i.length<=limits.indexLength).slice(0,limits.page)
  this.schedule(limits.idleMs)
 }
 /** Reorder this page only. Intent never adds work or interrupts a batch. */
 prioritize(index:string){
  if(this.disposed||this.paused||this.seen.has(index)||!this.indexes.includes(index)||this.intentIndex===index)return
  this.cancelPriority();this.intentIndex=index
  this.intentTimer=setTimeout(()=>{
   this.intentTimer=undefined;this.intentIndex=''
   if(!this.paused&&!this.seen.has(index)){
    this.indexes=[index,...this.indexes.filter(i=>i!==index)]
    if(!this.active){clearTimeout(this.timer);this.timer=undefined;this.schedule(0)}
   }
  },limits.intentMs)
 }
 cancelPriority(index?:string){if(index!==undefined&&index!==this.intentIndex)return;clearTimeout(this.intentTimer);this.intentTimer=undefined;this.intentIndex=''}
 clear(){++this.generation;this.cancelPriority();clearTimeout(this.timer);this.timer=undefined;this.active?.abort();this.indexes=[];this.seen.clear();this.bytes=0;this.failures=0;this.attempts=0;this.activity()}
 pause(value:boolean){this.paused=value;if(value){this.cancelPriority();clearTimeout(this.timer);this.timer=undefined;this.active?.abort();this.activity()}else this.schedule(limits.idleMs)}
 private activity(){
  const before=waiting.size>0,eligible=!this.disposed&&!this.paused&&!!this.owner&&this.failures<2&&this.bytes<=limits.pageBytes-1024&&(this.attempts<limits.requests||!!this.active)&&this.indexes.some(i=>!this.seen.has(i))
  if(eligible)waiting.add(this.token);else waiting.delete(this.token)
  if(before!==(waiting.size>0))for(const listener of listeners)listener()
 }
 private schedule(delay:number){
  this.activity()
  if(this.disposed||this.paused||this.active||this.timer||!this.owner||this.failures>=2||this.attempts>=limits.requests||this.bytes>limits.pageBytes-1024||!this.indexes.some(i=>!this.seen.has(i)))return
  this.timer=setTimeout(()=>{this.timer=undefined;void this.run()},delay)
 }
 private async run(){
  if(this.paused||this.active||this.disposed)return
  const generation=this.generation,owner=this.owner,kind=this.kind,indexes=this.indexes.filter(i=>!this.seen.has(i)).slice(0,limits.batch),controller=new AbortController()
  if(!indexes.length)return
  this.active=controller;++this.attempts;let locked=false
  try{
   const bytes=await this.deps.preload(owner,kind,indexes,controller.signal,Math.min(limits.batchBytes,limits.pageBytes-this.bytes))
   if(generation!==this.generation||controller.signal.aborted)return
   if(bytes===undefined){locked=true;--this.attempts;return}
   if(!Number.isFinite(bytes)||bytes<0||bytes>Math.min(limits.batchBytes,limits.pageBytes-this.bytes))throw Error('Invalid preload accounting')
   this.bytes+=bytes;for(const index of indexes)this.seen.add(index)
  }catch{
   if(generation===this.generation&&!controller.signal.aborted){++this.failures;for(const index of indexes)this.seen.add(index)}
  }finally{
   if(this.active===controller)this.active=undefined
   this.schedule(locked?1500:controller.signal.aborted?limits.idleMs:limits.betweenMs)
  }
 }
 dispose(){this.disposed=true;this.pause(true);this.clear()}
}
