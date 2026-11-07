type Destination={name?:unknown;query:Record<string,unknown>}
type Files=Record<string,string[]>
const pageKeys:Record<string,string>={character:'character','room-champion':'character',compendium:'compendium','character-new':'creator','homebrew-workshop':'workshop',rooms:'rooms',room:'room','room-join':'join'}

/** Select public files for the first requested page and an explicit room section.
 * No user data, component execution or guessed room role is involved. */
export function requestedPageFiles(to:Destination,map:Files):string[]{
  const page=typeof to.name==='string'&&Object.hasOwn(pageKeys,to.name)?pageKeys[to.name]:undefined
  if(!page)return[]
  const keys=[page]
  if(page==='room'){
    const section=to.query.section==='notebook'?'notebook':to.query.section==='maps'?'maps':to.query.section==='characters'||to.query.character?'character':undefined
    if(section)keys.push(section)
  }
  return[...new Set(keys.flatMap(key=>Array.isArray(map[key])?map[key]:[]))].filter(file=>/^\/assets\/[a-z0-9_.-]+\.(?:js|css)$/i.test(file))
}

export function createInitialPagePreparation(readMap:()=>Files,preload:(file:string)=>void){
  let prepared=false
  return(to:Destination)=>{
    if(prepared)return
    prepared=true
    try{for(const file of requestedPageFiles(to,readMap()))try{preload(file)}catch{/* An optional hint cannot interrupt sign-in. */}}catch{/* Missing/invalid metadata keeps normal navigation. */}
  }
}

export const preparePageDuringSignIn=createInitialPagePreparation(()=>{
  if(typeof document==='undefined')return{}
  return JSON.parse(document.getElementById('requested-page-files')?.textContent??'{}') as Files
},file=>{
  const href=new URL(file,window.location.href).href
  // Reuse main-entry/preloaded resources. Styles are fetched as hints, not
  // applied; Vite adds its ordinary stylesheet when the page is actually used.
  if([...document.querySelectorAll<HTMLLinkElement|HTMLScriptElement>('link[href],script[src]')].some(node=>('href'in node?node.href:node.src)===href))return
  const link=document.createElement('link')
  link.rel=file.endsWith('.css')?'preload':'modulepreload'
  if(file.endsWith('.css'))link.as='style'
  link.crossOrigin='anonymous';link.href=file
  document.head.append(link)
})
