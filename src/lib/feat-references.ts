/** Split imported feat lists without breaking commas inside prerequisites/choices. */
export function featNames(text: string): string[] {
  const names: string[] = []
  let current = '', depth = 0
  for (const char of text) {
    if (char === '(' || char === '[') depth++
    if (char === ')' || char === ']') depth = Math.max(0, depth - 1)
    if ((char === ',' || char === ';' || char === '\n') && depth === 0) { names.push(current); current = '' }
    else current += char
  }
  names.push(current)
  return [...new Set(names.map(name => name.replace(/^\s*[-*•]\s*/, '').trim()).filter(Boolean))]
}
export const featNameKey = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '')

export function featTerms(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const abilities: Record<string,string> = { str:'Strength',dex:'Dexterity',con:'Constitution',int:'Intelligence',wis:'Wisdom',cha:'Charisma' }
  return [...new Set(value.flatMap(entry => {
    const raw = typeof entry === 'string' ? entry : entry && typeof entry === 'object' ? String((entry as Record<string,unknown>).name ?? (entry as Record<string,unknown>)[':name'] ?? '') : ''
    if (!raw) return []
    const local=raw.replace(/^:/,'').replace(/^.*\//,'')
    return [abilities[local] ?? local.replace(/-/g,' ').replace(/^./,char=>char.toUpperCase())]
  }))]
}
