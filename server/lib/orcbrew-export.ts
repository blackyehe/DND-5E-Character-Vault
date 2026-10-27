import { readEdn,type EdnSpan,type EdnValue } from './edn'
import { MAX_PACK_BYTES,storedPackData } from './pack-storage'
import { MAX_PACK_MIB } from '../../shared/pack-limits'

type EdnMap=Record<string,EdnValue>
const isMap=(value:EdnValue):value is EdnMap=>!!value&&typeof value==='object'&&!Array.isArray(value)

/** Match the importer's structural checks without normalizing rules, generating
 * identities or populating its catalog cache. The new filename group consumes
 * one of the importer's 16 pack levels and one of its 128 EDN levels. */
function exportMap(pack:{filename:string;source:string}):string {
  const spans=new WeakMap<object,EdnSpan>()
  const root=readEdn(pack.source,()=>{},spans,{maxDepth:127,rootSpanOnly:true})
  if(!isMap(root))throw new Error('Orcbrew content must be an EDN map')
  let sections=0
  function visit(node:EdnMap,depth:number){
    if(depth>15)throw new Error('The collection would exceed 16 pack levels')
    for(const key of Object.keys(node)){
      const child=node[key]
      if(key.startsWith(':orcpub.dnd.e5/')){
        sections++
        if(!isMap(child))throw new Error('Orcbrew sections must be maps')
        for(const entry of Object.keys(child))if(!isMap(child[entry]))throw new Error('Orcbrew entries must be maps')
      }else if(!key.startsWith(':')&&isMap(child))visit(child,depth+1)
    }
  }
  visit(root,0)
  if(!sections)throw new Error('No Orcbrew content sections were found')
  const span=spans.get(root)!
  return pack.source.slice(span.start,span.end)
}

/** Keep raw source maps in named groups so colliding entry keys and unsupported
 * EDN survive. The collection uses the ordinary Orcbrew import format. */
export function combinedOrcbrew(packs:{filename:string;source:string}[]):string {
  if(!packs.length)throw new Error('There are no saved Orcbrew files to export.')
  let bytes=3
  const groups:string[]=[],names=new Set<string>()
  for(const pack of packs){
    let map:string
    try{
      map=exportMap(pack)
    }catch{throw new Error(`Could not read ${pack.filename}. Export or repair that file before combining your library.`)}
    const base=pack.filename.startsWith(':')?'File '+pack.filename:pack.filename
    let name=base,n=2
    while(names.has(name))name=`${base} (${n++})`
    names.add(name)
    const group=JSON.stringify(name)+' '+map+'\n'
    bytes+=Buffer.byteLength(group)
    if(bytes>MAX_PACK_BYTES)throw new Error(`The combined file exceeds the ${MAX_PACK_MIB} MiB import limit. Export the files individually instead.`)
    groups.push(group)
  }
  const source='{\n'+groups.join('')+'}'
  // Unique quoted names plus validated map slices form a valid collection.
  // Reparsing/normalizing the aggregate would retain another complete catalog.
  // A download must also fit the recipient's importer after storage compression.
  try{storedPackData({source,filename:'All homebrew.orcbrew'})}catch{throw new Error('The combined file exceeds the compressed import limit. Export the files individually instead.')}
  return source
}
