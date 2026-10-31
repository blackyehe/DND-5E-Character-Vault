interface Slot {
  resolve:()=>void
  reject:(reason:unknown)=>void
  signal?:AbortSignal
  abort?:()=>void
}
const interactive:Slot[]=[],background:Slot[]=[]
let timer:ReturnType<typeof setTimeout>|undefined,nextStart=0,interactiveStreak=0
function schedule(){
  if(timer!==undefined||!interactive.length&&!background.length)return
  nextStart=Math.max(nextStart,Date.now())
  timer=setTimeout(()=>{
    timer=undefined
    // Keep one global request pace. Interactive reads overtake queued imports;
    // sustained interactive traffic still leaves a slot for background work.
    const urgent=interactive.length>0&&(!background.length||interactiveStreak<8)
    const slot=(urgent?interactive:background).shift()!
    interactiveStreak=urgent?interactiveStreak+1:0
    if(slot.abort)slot.signal?.removeEventListener('abort',slot.abort)
    // Advance the scheduled cadence; resetting from a late timer's actual time
    // would accumulate timer jitter and slow a large import unnecessarily.
    nextStart+=40
    slot.resolve()
    schedule()
  },Math.max(0,nextStart-Date.now()))
}

/** Reserve at dispatch time so a long background queue cannot reserve seconds
 * of future slots ahead of a newly opened Compendium entry. */
export function waitForSrdRequest(urgent:boolean,signal?:AbortSignal):Promise<void>{
  if(signal?.aborted)return Promise.reject(signal.reason)
  return new Promise((resolve,reject)=>{
    const queue=urgent?interactive:background,slot:Slot={resolve,reject,signal}
    slot.abort=()=>{
      const index=queue.indexOf(slot);if(index<0)return
      queue.splice(index,1);signal?.removeEventListener('abort',slot.abort!)
      if(!interactive.length&&!background.length&&timer!==undefined){clearTimeout(timer);timer=undefined}
      reject(signal?.reason)
    }
    signal?.addEventListener('abort',slot.abort,{once:true})
    queue.push(slot);schedule()
  })
}
