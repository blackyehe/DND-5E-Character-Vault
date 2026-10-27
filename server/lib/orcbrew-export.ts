import { readEdn,type EdnSpan } from './edn'
import { parsedPack } from './orcbrew-library'
import { MAX_PACK_BYTES,storedPackData } from './pack-storage'
import { MAX_PACK_MIB } from '../../shared/pack-limits'

/** Keep raw source maps in named groups so colliding entry keys and unsupported
 * EDN survive. The collection uses the ordinary Orcbrew import format. */
export function combinedOrcbrew(packs:{filename:string;source:string}[]):string {
  if(!packs.length)throw new Error('There are no saved Orcbrew files to export.')
  let bytes=3
  const groups:string[]=[],names=new Set<string>()
  for(const pack of packs){
    const spans=new WeakMap<object,EdnSpan>()
    let root:ReturnType<typeof readEdn>
    try{
      parsedPack(pack)
      root=readEdn(pack.source,()=>{},spans)
    }catch{throw new Error(`Could not read ${pack.filename}. Export or repair that file before combining your library.`)}
    if(!root||typeof root!=='object'||Array.isArray(root))throw new Error(`Invalid Orcbrew map in ${pack.filename}.`)
    const span=spans.get(root)!
    const base=pack.filename.startsWith(':')?'File '+pack.filename:pack.filename
    let name=base,n=2
    while(names.has(name))name=`${base} (${n++})`
    names.add(name)
    const group=JSON.stringify(name)+' '+pack.source.slice(span.start,span.end)+'\n'
    bytes+=Buffer.byteLength(group)
    if(bytes>MAX_PACK_BYTES)throw new Error(`The combined file exceeds the ${MAX_PACK_MIB} MiB import limit. Export the files individually instead.`)
    groups.push(group)
  }
  const source='{\n'+groups.join('')+'}'
  try{parsedPack({source,filename:'All homebrew.orcbrew'})}catch{throw new Error('These files cannot be combined into a supported Orcbrew collection. Export them individually instead.')}
  // A download must also fit the recipient's importer after storage compression.
  try{storedPackData({source,filename:'All homebrew.orcbrew'})}catch{throw new Error('The combined file exceeds the compressed import limit. Export the files individually instead.')}
  return source
}
