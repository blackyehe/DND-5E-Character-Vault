export type EdnValue = string | number | boolean | null | EdnValue[] | { [key: string]: EdnValue }
const ednSet = Symbol('EDN set')
export const isEdnSet = (value: unknown[]) => Object.hasOwn(value, ednSet)
export interface EdnSpan {start:number;end:number;fields?:Record<string,{keyStart:number;start:number;end:number}>;items?:{start:number;end:number}[]}
interface EdnReadOptions { maxDepth?:number; rootSpanOnly?:boolean }

/** Reads data only. Tags are retained as data and never executed. */
export function readEdn(source: string, onNonFinite: () => void = () => {}, spans?:WeakMap<object,EdnSpan>, options:EdnReadOptions = {}): EdnValue {
  let cursor = 0
  const maxDepth=options.maxDepth??128
  const discard = Symbol('discard')
  const fail = (message: string): never => {
    throw new Error(`${message} at character ${cursor + 1}`)
  }
  const isSpace = (char: string) => /[\s,]/u.test(char)

  function space() {
    while (cursor < source.length) {
      if (isSpace(source[cursor])) cursor++
      else if (source[cursor] === ';') {
        while (cursor < source.length && source[cursor] !== '\n') cursor++
      } else break
    }
  }

  function token() {
    const start = cursor
    while (cursor < source.length && !/[\s,\[\]{}()";]/u.test(source[cursor])) cursor++
    if (start === cursor) fail('Unexpected EDN token')
    return source.slice(start, cursor)
  }

  function string() {
    // JSON-authored source/provenance strings can be large. Decode their slices
    // with the native parser instead of constructing one rope node per character.
    const start=cursor
    let end=source.indexOf('"',start+1)
    while(end!==-1){
      let escapes=0
      for(let i=end-1;i>start&&source[i]==='\\';i--)escapes++
      if(escapes%2===0){
        try{const value=JSON.parse(source.slice(start,end+1)) as string;cursor=end+1;return value}catch{break}
      }
      end=source.indexOf('"',end+1)
    }
    cursor++
    let result = ''
    const escapes: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '"': '"', '\\': '\\' }
    while (cursor < source.length) {
      const char = source[cursor++]
      if (char === '"') return result
      if (char !== '\\') result += char
      else {
        const escaped = source[cursor++]
        if (escaped === 'u') {
          const hex = source.slice(cursor, cursor + 4)
          if (!/^[\da-f]{4}$/i.test(hex)) fail('Invalid unicode escape')
          result += String.fromCharCode(parseInt(hex, 16))
          cursor += 4
        } else if (Object.hasOwn(escapes, escaped)) result += escapes[escaped]
        else fail('Invalid string escape')
      }
    }
    return fail('Unterminated string')
  }

  function nextValue(depth: number): EdnValue {
    while (true) {
      const result = form(depth)
      if (result !== discard) return result
    }
  }

  function form(depth: number): EdnValue | typeof discard {
    if (depth > maxDepth) fail(`EDN nesting exceeds ${maxDepth} levels`)
    space()
    if (cursor >= source.length) fail('Unexpected end of EDN data')
    const char = source[cursor]
    const start=cursor
    if (char === '"') return string()
    if (source.startsWith('#_', cursor)) {
      cursor += 2
      nextValue(depth + 1)
      return discard
    }
    const set = source.startsWith('#{', cursor)
    if (set || char === '{' || char === '[' || char === '(') {
      cursor += set ? 2 : 1
      const closing = set || char === '{' ? '}' : char === '[' ? ']' : ')'
      const values: EdnValue[] = []
      // Export needs only the root slice; avoid retaining field/item positions
      // throughout a large source tree when its caller does not request them.
      const capture=spans&&(!options.rootSpanOnly||depth===0)
      const positions:{start:number;end:number}[]|undefined=capture&&!options.rootSpanOnly?[]:undefined
      while (true) {
        space()
        if (cursor >= source.length) fail('Unterminated collection')
        if (source[cursor] === closing) { cursor++; break }
        if ('}])'.includes(source[cursor])) fail('Mismatched collection delimiter')
        const childStart=cursor,value = form(depth + 1)
        if (value !== discard) {values.push(value);positions?.push({start:childStart,end:cursor})}
      }
      if (set) Object.defineProperty(values, ednSet, { value: true })
      if (set || char !== '{') {if(capture)spans.set(values,{start,end:cursor,...(positions?{items:positions}:{})});return values}
      if (values.length % 2 !== 0) fail('EDN map requires key/value pairs')
      const result: Record<string, EdnValue> = Object.create(null)
      const fields:NonNullable<EdnSpan['fields']>|undefined=positions?Object.create(null):undefined
      for (let index = 0; index < values.length; index += 2) {
        const key = values[index]
        if (key !== null && typeof key === 'object') fail('Collection map keys are not supported')
        const name = String(key)
        if (Object.hasOwn(result, name)) fail(`Duplicate EDN map key ${name}`)
        result[name] = values[index + 1]
        if(fields&&positions)fields[name]={keyStart:positions[index].start,...positions[index+1]}
      }
      if(capture)spans.set(result,{start,end:cursor,...(fields?{fields}:{})})
      return result
    }
    if ('}])'.includes(char)) fail('Unexpected collection delimiter')
    if (char === '\\') {
      cursor++
      if ('[]{}()";'.includes(source[cursor] ?? '') && cursor < source.length) return source[cursor++]
      const value = token()
      const names: Record<string, string> = { newline: '\n', return: '\r', space: ' ', tab: '\t', backspace: '\b', formfeed: '\f' }
      if (Object.hasOwn(names, value)) return names[value]
      if (/^u[\da-f]{4}$/i.test(value)) return String.fromCharCode(parseInt(value.slice(1), 16))
      if ([...value].length === 1) return value
      return fail('Invalid character literal')
    }
    const atom = token()
    if (['##NaN', '##Inf', '##-Inf'].includes(atom)) { onNonFinite(); return null }
    if (atom.startsWith('#')) {
      if (!/^#[a-zA-Z][\w./-]*$/.test(atom)) fail('Unsupported EDN dispatch')
      const tagged={ ':edn/tag': atom.slice(1), ':edn/value': nextValue(depth + 1) }
      if(spans&&(!options.rootSpanOnly||depth===0))spans.set(tagged,{start,end:cursor});return tagged
    }
    if (atom === 'nil') return null
    if (atom === 'true') return true
    if (atom === 'false') return false
    if (/^[+-]?\d+N$/.test(atom)) return atom.slice(0, -1)
    if (/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?M?$/.test(atom)) {
      const value = Number(atom.replace(/M$/, ''))
      if (!Number.isFinite(value)) { onNonFinite(); return null }
      return Number.isInteger(value) && !Number.isSafeInteger(value) ? atom : value
    }
    return atom
  }

  const result = nextValue(0)
  space()
  while (source.startsWith('#_', cursor)) { form(0); space() }
  if (cursor !== source.length) fail('Unexpected trailing EDN data')
  return result
}
