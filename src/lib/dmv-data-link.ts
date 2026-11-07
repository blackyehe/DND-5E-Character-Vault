// A user-opened public data page is a normal browser navigation, not a proxy.
// Never turn an arbitrary pasted address into an external action.
export function dmvDataLink(input:string):string|undefined {
  try {
    const url=new URL(input.trim()),match=url.pathname.match(/^\/(?:pages\/)?dnd\/5e\/characters\/(\d{1,20})\/?$/)
    if(!['http:','https:'].includes(url.protocol)||!['www.dungeonmastersvault.com','dungeonmastersvault.com'].includes(url.hostname.toLowerCase())||url.port||url.username||url.password||!match)return undefined
    return `https://www.dungeonmastersvault.com/dnd/5e/characters/${match[1]}`
  }catch{return undefined}
}
