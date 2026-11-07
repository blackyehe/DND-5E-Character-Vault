import type {RequestHandler} from 'express'
import {getDeadline,waitUntil} from '@vercel/functions'
import {env} from '../env'
import {runPackPreparation} from '../lib/pack-preparation'

/** Register continuation while request context exists, execute after its response.
 * A closed/failed/unauthenticated request cannot start preparation. */
export const packPreparation:RequestHandler=(req,res,next)=>{
 if(env.COMPENDIUM_PACK_PREPARATION!=='on')return next()
 const summaryOnly=req.method==='POST'&&/^\/api\/content\/orcbrew-packs\/[a-f\d]{24}\/summary\/?$/i.test(req.path)
 const mutation=!summaryOnly&&!['GET','HEAD','OPTIONS'].includes(req.method)&&/^\/api\/(?:content\/orcbrew-packs(?:\/|$)|workshop(?:\/|$)|workshop-trash(?:\/|$)|library-restore$)/.test(req.path)
 const idle=req.method==='GET'&&req.get('X-Compendium-Idle')==='1'&&/^\/api\/compendium-browse\/[^/]+\/local-revision$/.test(req.path)
 if(!mutation&&!idle)return next()
 let limit:Date|undefined
 try{limit=getDeadline()}catch{return next()}
 let registered=true
 const task=new Promise<boolean>(resolve=>{
  const finish=()=>{res.removeListener('close',close);resolve(true)}
  const close=()=>{res.removeListener('finish',finish);resolve(false)}
  res.once('finish',finish);res.once('close',close)
 }).then(async complete=>{
  if(!registered||!complete||res.statusCode>=400||!req.userId)return
  const remaining=limit?limit.getTime()-Date.now()-10000:90000
  if(remaining<5000)return
  await runPackPreparation(req.userId,{force:mutation,deadline:performance.now()+remaining})
 }).catch(()=>{console.warn('Automatic pack preparation unavailable; current reads remain available')})
 try{waitUntil(task)}catch{registered=false;console.warn('Automatic preparation continuation unavailable')}
 next()
}
