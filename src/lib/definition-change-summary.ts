import type {DefinitionReviewRow} from '../../shared/definition-review'

const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
const list=(v:unknown)=>Array.isArray(v)?v.map(object):[]
const equal=(a:unknown,b:unknown):boolean=>{
 if(Array.isArray(a)||Array.isArray(b))return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&a.every((v,i)=>equal(v,b[i]))
 if(a&&b&&typeof a==='object'&&typeof b==='object'){const x=object(a),y=object(b),keys=Object.keys(x);return keys.length===Object.keys(y).length&&keys.every(k=>Object.hasOwn(y,k)&&equal(x[k],y[k]))}
 return a===b
}
const title=(v:unknown)=>String(v??'').replace(/[-_]/g,' ').replace(/^./,c=>c.toUpperCase())
export interface ChangeSummary {label:string;detail?:string}
export function definitionChangeSummary(row:DefinitionReviewRow,sourceName=''):ChangeSummary[]{
 const result:ChangeSummary[]=[],resourceChange=row.changes.find(c=>c.field==='resources'),equipmentChange=row.changes.find(c=>c.field==='equipment')
 const trackers=list(equipmentChange?.after).flatMap(item=>list(item.trackers))
 const name=(r:Record<string,unknown>)=>{const value=String(r.name??'Tracker');return sourceName&&value.startsWith(sourceName+' · ')?value.slice(sourceName.length+3):value}
 const detail=(r:Record<string,unknown>,maximum=true)=>{
  const tracker=trackers.find(t=>t.id===object(r.source).trackerId)
  return [maximum?(r.unlimited?'Unlimited':`${r.max} ${r.max===1?'use':'uses'}`):'',r.recovery==='manual'?'Manual recovery':`${title(r.recovery)} rest`,tracker?.activation?`While ${tracker.activation}`:''].filter(Boolean).join(' · ')
 }
 if(resourceChange){
  const before=list(resourceChange.before),after=list(resourceChange.after)
  for(const next of after){const old=before.find(r=>r.id===next.id);if(!old)result.push({label:`Add ${name(next)}`,detail:detail(next)});else if(!equal(old,next))result.push({label:old.name!==next.name?`Rename ${name(old)} to ${name(next)}`:`Update ${name(next)}`,detail:old.max!==next.max?`${old.max} → ${next.max} uses · ${detail(next,false)}`:detail(next)})}
  for(const old of before)if(!after.some(r=>r.id===old.id))result.push({label:`Remove ${name(old)}`})
 }
 for(const change of row.changes){
  if(change.field==='resources')continue
  if(change.field==='benefits and defenses'){
   if(!equal(object(change.before).effective,object(change.after).effective))result.push({label:'Update benefits and defenses'})
  }else if(change.field==='equipment'){
   const before=list(change.before),fields=['name','description','benefits','effects','armor','weapon','weight','magicBonus','requiresAttunement','rarity','category','tags','value']
   for(const next of list(change.after)){const old=before.find(r=>r._id===next._id);if(!old||fields.some(k=>!equal(old[k],next[k]))||!resourceChange&&!equal(old.trackers,next.trackers))result.push({label:`Update ${String(next.name??'item')} rules`})}
  }else {const labels:Record<string,string>={meta:'character details',homebrew:'Workshop rules',combat:'combat statistics',saves:'saving throws',abilities:'ability scores',proficiencies:'training'};result.push({label:`Update ${labels[change.field]??title(change.field).toLowerCase()}`})}
 }
 return result.length?result:[{label:'Use the latest saved rules',detail:'No effective statistics change.'}]
}
export function definitionReviewWarnings(row:DefinitionReviewRow){
 // These standard notices are stated by the preservation/confirmation copy.
 // Keep every other warning, including HP conflicts and blocked selections.
 return row.warnings.filter(w=>!w.startsWith('Confirm this is the source intended for this character.')&&!w.startsWith('Custom item values are kept when they differ from the source.'))
}
