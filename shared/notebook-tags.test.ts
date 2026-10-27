import {describe,it,expect} from 'vitest'
import {notebookTags,notebookMatchesTags,notebookTagOptions,mergeNotebookTagChanges} from './notebook-tags'
describe('notebook tags',()=>{
  it('reapplies only local additions/removals while preserving simultaneous tag changes',()=>{
    expect(mergeNotebookTagChanges(['Shared','Other DM addition'],['Shared','Remove me'],['Shared','My addition'])).toEqual(['Shared','Other DM addition','My addition'])
    expect(mergeNotebookTagChanges(['SHARED','Remove me','Concurrent'],['Shared','Remove me'],['shared','New'])).toEqual(['SHARED','Concurrent','New'])
    expect(mergeNotebookTagChanges(['Concurrent'],['Removed elsewhere'],['Removed elsewhere'])).toEqual(['Concurrent'])
    expect(mergeNotebookTagChanges(Array.from({length:20},(_,i)=>'Tag '+i),[],['My new tag'])).toHaveLength(21)
  })
  it('keeps custom labels, normalizes whitespace and Unicode, and deduplicates case-insensitively',()=>{
    expect(notebookTags([' Magellan ','magellan','Custom, tag','  Story   lead ','Árny','A\u0301rny'])).toEqual(['Magellan','Custom, tag','Story lead','Árny'])
    expect(notebookMatchesTags({tags:['Amdurun','Plot lead']},['amdurun','PLOT LEAD'])).toBe(true)
    expect(notebookMatchesTags({tags:['Amdurun']},['Amdurun','Plot lead'])).toBe(false)
  })
  it('counts each tag once per entry and supports legacy records',()=>{
    expect(notebookTagOptions([{tags:['Magellan','magellan']},{tags:['MAGELLAN','Custom']},{}])).toEqual([{name:'Custom',count:1},{name:'Magellan',count:2}])
    expect(notebookMatchesTags({},[])).toBe(true)
  })
})

it('merges a catalog with usage counts without counting unused names as entries',()=>{expect(notebookTagOptions([{tags:['Used','used']}],['USED','Unused','unused'])).toEqual([{name:'Unused',count:0},{name:'Used',count:1}])})
