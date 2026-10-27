// Disposable, offline performance exploration. No DB/API access or production imports.
import {readFileSync,writeFileSync} from 'node:fs'
import {gzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {performance} from 'node:perf_hooks'
import {queryBrowseIndex,type BrowseIndex,type BrowseKind} from '../compendium-code-prefetch/review/shared/compendium-browse'
import {emptyItemFilters} from '../compendium-code-prefetch/review/src/lib/magic-item-filters'

const root='output/compendium-storage-research'
const sourcePath='.preview.local/compendium-performance/indexes.json'
const source=readFileSync(sourcePath,'utf8')
const start=performance.now(),indexes=JSON.parse(source) as Record<BrowseKind,BrowseIndex>
const fixtureParseMs=performance.now()-start
const size=(value:unknown)=>{const json=JSON.stringify(value),bytes=Buffer.byteLength(json),gzip=gzipSync(json);return {jsonBytes:bytes,gzipBytes:gzip.length,json}}
const percentile=(values:number[],p:number)=>[...values].sort((a,b)=>a-b)[Math.min(values.length-1,Math.floor(p*values.length))]!
const requests=[
  {label:'first page',query:'',facets:{},items:emptyItemFilters()},
  {label:'name search',query:'a',facets:{},items:emptyItemFilters()},
  {label:'specific name',query:'aboleth',facets:{},items:emptyItemFilters()},
  {label:'specific item',query:'flame tongue',facets:{},items:emptyItemFilters()},
  {label:'source filter',query:'',facets:{source:'MM'},items:emptyItemFilters()},
  {label:'combined item filters',query:'flame tongue',facets:{source:'DMG'},items:{...emptyItemFilters(),weapon:'longsword',damage:'fire',rarity:'rare',attunement:'required'}},
]
const categories:Record<string,unknown>={}
for(const [kind,index] of Object.entries(indexes) as [BrowseKind,BrowseIndex][]){
  const sized=size(index),parseSamples:number[]=[]
  for(let i=0;i<10;i++){const t=performance.now();JSON.parse(sized.json);parseSamples.push(performance.now()-t)}
  const queries=requests.map(request=>{
    const samples:number[]=[];let page:ReturnType<typeof queryBrowseIndex>|undefined
    for(let i=0;i<15;i++){const t=performance.now();page=queryBrowseIndex(index,kind,{...request,page:1},'local-historical-fixture');samples.push(performance.now()-t)}
    return {label:request.label,query:request.query,p50Ms:percentile(samples,.5),p95Ms:percentile(samples,.95),groups:page!.total,matchedVersions:page!.matchedEntries,firstNames:page!.entries.slice(0,3).map(e=>e.name)}
  })
  const first=queryBrowseIndex(index,kind,{query:'',page:1,facets:{},items:emptyItemFilters()},'local-historical-fixture')
  categories[kind]={records:index.records.length,groups:first.total,jsonBytes:sized.jsonBytes,gzipBytes:sized.gzipBytes,pageGzipBytes:size(first).gzipBytes,parseP50Ms:percentile(parseSamples,.5),parseP95Ms:percentile(parseSamples,.95),queries}
}
const nameDirectory=Object.entries(indexes).flatMap(([kind,index])=>index.records.map(({entry})=>({kind,index:entry.index,name:entry.name,source:entry.sourcePack,displayName:entry.displayName})))
const directory=size(nameDirectory)
const detailsPath='.preview.local/compendium-performance/details.json'
const detailText=readFileSync(detailsPath,'utf8'),detailStart=performance.now(),details=JSON.parse(detailText) as Record<string,unknown>
const detailsParseMs=performance.now()-detailStart
let sumDetailGzipBytes=0,maxDetailJsonBytes=0,maxDetailGzipBytes=0
const detailSizes:number[]=[]
for(const entry of Object.values(details)){
  const sized=size(entry);sumDetailGzipBytes+=sized.gzipBytes;maxDetailJsonBytes=Math.max(maxDetailJsonBytes,sized.jsonBytes);maxDetailGzipBytes=Math.max(maxDetailGzipBytes,sized.gzipBytes);detailSizes.push(sized.gzipBytes)
}
const aboleths=(indexes.monsters.records.filter(r=>r.entry.name.toLowerCase().includes('aboleth'))).map(({entry})=>{const detail=details[`monsters/${entry.index}`];return {name:entry.name,source:entry.sourcePack,hasDetail:!!detail,...detail?{detailJsonBytes:size(detail).jsonBytes,detailGzipBytes:size(detail).gzipBytes}:{}}})
const report={recordedAt:new Date().toISOString(),sourcePath,fixtureSha256:createHash('sha256').update(source).digest('hex'),fixtureBytes:Buffer.byteLength(source),fixtureParseMs,baselineCommit:'8010a11',note:'Offline Node CPU/size profile of historical 126-pack fixture; not a fresh production snapshot, browser benchmark, DB benchmark or end-to-end loading prediction. No saved data modified. Uses baseline query code unchanged.',categories,nameDirectory:{records:nameDirectory.length,jsonBytes:directory.jsonBytes,gzipBytes:directory.gzipBytes},details:{records:Object.keys(details).length,jsonBytes:Buffer.byteLength(detailText),parseMs:detailsParseMs,sumIndependentGzipBytes:sumDetailGzipBytes,medianIndependentGzipBytes:percentile(detailSizes,.5),maxJsonBytes:maxDetailJsonBytes,maxGzipBytes:maxDetailGzipBytes,aboleths},processMemory:process.memoryUsage()}
writeFileSync(`${root}/catalogue-profile.json`,JSON.stringify(report,null,2)+'\n')
console.log(JSON.stringify({fixtureBytes:report.fixtureBytes,categories:Object.fromEntries(Object.entries(categories).map(([kind,value])=>{const v=value as any;return [kind,{records:v.records,gzipBytes:v.gzipBytes,parseP50Ms:v.parseP50Ms,queryP50Ms:v.queries[0].p50Ms}]})),nameDirectory:report.nameDirectory,details:report.details,memoryMiB:Math.round(report.processMemory.rss/1024/1024)},null,2))
