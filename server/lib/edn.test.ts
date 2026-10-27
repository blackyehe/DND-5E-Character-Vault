import { describe,it,expect } from 'vitest'
import { readEdn } from './edn'

describe('EDN string decoding',()=>{
  it('preserves nested quoted JSON, escapes, Unicode, long values and source spans',()=>{
    const values=['','é 🗡','quote " and slash \\',JSON.stringify({rules:['a"b','c\\d','e\nf']}),'x'.repeat(200000),'line\n\r\t\b\fend']
    const source='{:values ['+values.map(v=>JSON.stringify(v)).join(' ')+'] :tail 7}',spans=new WeakMap()
    const parsed=readEdn(source,()=>{},spans) as Record<string,unknown>
    expect(parsed[':values']).toEqual(values);expect(parsed[':tail']).toBe(7)
    const tail=spans.get(parsed).fields[':tail'];expect(source.slice(tail.start,tail.end)).toBe('7')
  })
  it('retains EDN literal newlines and rejects malformed escapes or unterminated strings',()=>{
    expect(readEdn('"first\nsecond"')).toBe('first\nsecond')
    for(const source of ['"bad\\q"','"bad\\uZZZZ"','"unterminated','"escape\\"'])expect(()=>readEdn(source)).toThrow()
  })
})
