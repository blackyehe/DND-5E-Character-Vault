import fs from 'node:fs'
import path from 'node:path'
import {pathToFileURL} from 'node:url'

const median=values=>{const a=values.toSorted((x,y)=>x-y),n=a.length;return n%2?a[(n-1)/2]:(a[n/2-1]+a[n/2])/2}
const percentile=(values,p)=>values.toSorted((x,y)=>x-y)[Math.max(0,Math.ceil(values.length*p)-1)]
function interval(deltas){
 let seed=20261102
 const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return (seed>>>0)/4294967296}
 const samples=Array.from({length:10000},()=>median(Array.from({length:deltas.length},()=>deltas[Math.floor(random()*deltas.length)])))
 return [percentile(samples,.025),percentile(samples,.975)]
}

/** A failed or incomplete check always holds the candidate. This never deploys. */
export function evaluateMapDelivery({plan,browser,security,audit,postflight,golden}){
 const reasons=[],cohorts={}
 const require=(condition,message)=>{if(!condition)reasons.push(message)}
 require(plan?.measurements?.browserFullImagePairs===24&&plan?.measurements?.browserUiColdPairs===12&&plan?.measurements?.browserUiWarmPairs===12,'Predeclared sample counts do not match this acceptance policy')
 require(browser?.done===true&&browser?.phase==='complete','Browser comparison did not complete')
 require(Array.isArray(browser?.errors)&&browser.errors.length===0,'Browser comparison reported an error')
 require(Date.parse(browser?.startedAt)>=Date.parse(plan?.registeredAt),'Measurements predate acceptance registration')
 require(security?.passed===true,'Hosted access/cache checks failed or did not complete')
 require(security?.cleaned===true,'Synthetic fixture cleanup failed')
 require(Array.isArray(security?.checks)&&security.checks.length>=8&&security.checks.every(c=>c.passed===true),'Hosted regression coverage is incomplete')
 require(audit?.passed===true&&audit.productionUnchanged===true&&audit.reports?.length===2&&audit.reports.every(r=>r.exact===true&&r.files===plan.sourceFiles),'Deployment source audit failed')
 require(postflight?.passed===true&&postflight.productionUnchanged===true&&postflight.reports?.length===2&&postflight.reports.every((r,i)=>r.exact===true&&r.id===audit?.reports?.[i]?.id),'Postflight source/production-alias verification failed')
 require(golden?.bytes>2*1024*1024&&/^[a-f0-9]{64}$/.test(golden?.sha256??'')&&golden.width>0&&golden.height>0,'Golden image identity is missing')
 const warmups=Array.isArray(browser?.warmups)?browser.warmups:[]
 require(warmups.length===6&&['full','cold','warm'].every(cohort=>['control','candidate'].every(label=>warmups.filter(r=>r.cohort===cohort&&r.label===label&&Number.isFinite(r.ms)&&r.ms>0&&r.ms<=35000).length===1)),'Required warmups did not complete')
 const records=Array.isArray(browser?.records)?browser.records:[]
 require(records.length===96,'Expected exactly 96 measured observations')
 for(const [cohort,count,reduction]of [['full',24,.15],['cold',12,.10],['warm',12,0]]){
  const rows=records.filter(r=>r.cohort===cohort),pairs=[],before=[],after=[]
  require(rows.length===count*2,cohort+': incomplete cohort')
  if(rows.length!==count*2)continue
  for(let pair=0;pair<count;pair++){
   const observations=rows.filter(r=>r.pair===pair),control=observations.find(r=>r.label==='control'),candidate=observations.find(r=>r.label==='candidate')
   if(observations.length!==2||!control||!candidate){require(false,cohort+': missing/duplicate pair '+pair);continue}
   require(observations[0].label===(pair%2?'candidate':'control'),cohort+': pair order is not balanced')
   for(const r of observations){
    require(Number.isFinite(r.ms)&&r.ms>0&&r.ms<=35000,cohort+': invalid duration/deadline')
    require(r.width===golden?.width&&r.height===golden?.height,cohort+': image dimensions changed')
    if(cohort==='full'){
     require(r.bytes===golden?.bytes&&r.sha256===golden?.sha256,'Full image byte/hash identity changed')
     require(r.cacheControl==='private, no-cache','Image cache policy changed')
     require(r.label==='candidate'?Number(r.contentLength)===golden?.bytes:r.contentLength===null,'Image response implementation did not match its cohort')
    }else{
     require(Array.isArray(r.errors)&&r.errors.length===0,'Page error during UI opening')
     require(r.resources?.length===1&&r.resources[0].encodedBytes===golden?.bytes,'UI did not load exactly one complete image')
     require(cohort==='cold'?r.resources?.[0]?.transferBytes>=golden?.bytes:r.resources?.[0]?.transferBytes<10000,'UI cache cohort mismatch')
    }
   }
   if(Number.isFinite(control.ms)&&Number.isFinite(candidate.ms)){before.push(control.ms);after.push(candidate.ms);pairs.push({delta:candidate.ms-control.ms,relative:(candidate.ms-control.ms)/control.ms})}
  }
  if(pairs.length!==count)continue
  const deltas=pairs.map(p=>p.delta),pairedMedianMs=median(deltas),pairedRelative=median(pairs.map(p=>p.relative)),ci=interval(deltas),controlP90Ms=percentile(before,.9),candidateP90Ms=percentile(after,.9),controlMedianMs=median(before),candidateMedianMs=median(after)
  const tailOk=candidateP90Ms<=controlP90Ms+Math.max(100,controlP90Ms*.1)
  require(tailOk,cohort+': p90 regression exceeds the declared budget')
  if(cohort==='warm')require(candidateMedianMs<=controlMedianMs+Math.max(100,controlMedianMs*.1),'Warm median regression exceeds the declared budget')
  else{
   require(pairedMedianMs<=-100,cohort+': paired gain is less than 100ms')
   require(pairedRelative<=-reduction,cohort+': paired percentage gain is below threshold')
   require(ci[1]<0,cohort+': 95% paired bootstrap interval does not establish an improvement')
  }
  cohorts[cohort]={pairs:count,controlMedianMs,candidateMedianMs,controlP90Ms,candidateP90Ms,pairedMedianMs,pairedMedianPercent:pairedRelative*100,pairedBootstrap95Ms:ci,controlMaxMs:Math.max(...before),candidateMaxMs:Math.max(...after)}
 }
 return {decision:reasons.length?'HOLD':'PASS',positiveEffectEstablished:reasons.length===0,requiresManualInspection:false,productionPromotion:false,reasons:[...new Set(reasons)],cohorts,note:'This classifies finite automated evidence; it does not guarantee all future networks or authorize deployment.'}
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const args=process.argv.slice(2),options={};for(let i=0;i<args.length;i+=2)options[args[i].replace(/^--/,'')]=args[i+1]
 let result
 try{
  const read=name=>JSON.parse(fs.readFileSync(options[name],'utf8'))
  result=evaluateMapDelivery({plan:read('plan'),browser:read('browser'),security:read('security'),audit:read('audit'),postflight:read('postflight'),golden:read('golden')})
 }catch(error){result={decision:'HOLD',positiveEffectEstablished:false,requiresManualInspection:false,reasons:['Acceptance inputs are unavailable or invalid: '+error.message]}}
 if(options.out){fs.mkdirSync(path.dirname(options.out),{recursive:true});fs.writeFileSync(options.out,JSON.stringify({...result,at:new Date().toISOString()},null,2))}
 console.log(JSON.stringify(result,null,2));process.exitCode=result.decision==='PASS'?0:2
}
