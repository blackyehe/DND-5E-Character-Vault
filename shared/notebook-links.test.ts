import {describe, expect, it} from 'vitest'
import {activeNotebookLink, insertNotebookLink, notebookLinkMatches, notebookLinkSuggestions, notebookWikiLink} from './notebook-links'

const targets=[{id:'a'.repeat(24),title:'Magellán',folder:'Cities'},{id:'b'.repeat(24),title:'Twin',folder:'People'},{id:'c'.repeat(24),title:'Twin',folder:'Places'}]
describe('notebook wiki links',()=>{
  it('resolves names, IDs, aliases, headings, extensions and composed accents consistently',()=>{
    for(const value of ['magellán',' Magellán.md#History|the city','Magella\u0301n'])expect(notebookLinkMatches(value,targets).map(t=>t.id)).toEqual([targets[0]!.id])
    expect(notebookWikiLink('Magellán#History|A | B')).toEqual({target:'Magellán',suffix:'#History',alias:'A | B'})
    expect(notebookLinkMatches(targets[0]!.id,targets)).toEqual([targets[0]])
    expect(notebookLinkMatches('Twin',[...targets,targets[1]!])).toHaveLength(2)
    expect(notebookLinkMatches('unknown',targets)).toEqual([])
  })
  it('offers accent-insensitive choices without silently resolving similar or duplicate names',()=>{
    expect(notebookLinkSuggestions('Magellan',targets)).toEqual([targets[0]])
    expect(notebookLinkMatches('Magellan',targets)).toEqual([])
    expect(notebookLinkMatches('Twin',targets)).toHaveLength(2)
    expect(notebookLinkSuggestions('',targets,targets[0]!.id)).toEqual([targets[1],targets[2]])
    expect(notebookLinkSuggestions('',Array.from({length:40},(_,i)=>({id:String(i),title:'Note '+i})))).toHaveLength(8)
  })
  it('completes the caret link without touching the rest of the draft or losing alias/heading',()=>{
    const body='Before [[Twin#History|the person]] after',caret=body.indexOf('History')
    const active=activeNotebookLink(body,caret)!
    const result=insertNotebookLink(body,active,targets[1]!)
    expect(result.body).toBe(`Before [[${targets[1]!.id}#History|the person]] after`)
    expect(result.body.slice(result.caret)).toBe(' after')
    expect(notebookLinkMatches(`${targets[1]!.id}|renamed`,[{...targets[1]!,title:'New name'},targets[2]!])).toEqual([{...targets[1]!,title:'New name'}])
    const partial='Before [[Mag'
    expect(insertNotebookLink(partial,activeNotebookLink(partial,partial.length)!,targets[0]!).body).toBe(`Before [[${targets[0]!.id}|Magellán]]`)
  })
  it('does not autocomplete code, selections, unrelated lines or already-passed links',()=>{
    for(const body of ['`[[Twin]]`','```\n[[Twin','```js [[Twin','[[Twin]] after','[[Twin\nNew line'])expect(activeNotebookLink(body,body.length)).toBeNull()
    expect(activeNotebookLink('[[Twin',3,4)).toBeNull()
    const body='```\n[[literal]]\n```\n[[Twin'
    expect(activeNotebookLink(body,body.length)?.value).toBe('Twin')
  })
})
