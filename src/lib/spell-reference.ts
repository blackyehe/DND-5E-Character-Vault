/** Decode only references that retain a readable key; hashes never imply a spell name. */
export function spellReferenceLabel(index:string) {
  const legacy=index.match(/^homebrew-[a-f0-9]{24}-(.+)$/i)?.[1]
  const key=legacy??index
  if(/^homebrew-spells-[a-f0-9]{32}$/i.test(key))return 'Unavailable imported spell'
  return key.replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase())
}
export function legacySrdSpellKey(index:string):string|null {
  const key=index.match(/^homebrew-[a-f0-9]{24}-(.+)$/i)?.[1]
  return key&&/^[a-z][a-z0-9-]*$/.test(key)&&!/[a-f0-9]{32}$/.test(key)?key:null
}
