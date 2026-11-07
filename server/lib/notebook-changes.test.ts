import {describe,expect,it} from 'vitest'
import {notebookChangeIdentity,notebookChangeIncrements} from './notebook-changes'
const a='a'.repeat(24),b='b'.repeat(24)
const entry={kind:'entry',section:'journal',audience:'room',deletedAt:null}
describe('transactional notebook navigation change counters',()=>{
  it('invalidates both prior/new visibility and sections exactly once',()=>{
    expect(notebookChangeIncrements({...entry,audience:'characters',characterIds:[a]}, {...entry,section:'story-items',audience:'characters',characterIds:[b]})).toEqual({
      'notebookChanges.dm.all':1,'notebookChanges.dm.journal':1,'notebookChanges.dm.story-items':1,
      [`notebookChanges.characters.${a}.all`]:1,[`notebookChanges.characters.${a}.journal`]:1,
      [`notebookChanges.characters.${b}.all`]:1,[`notebookChanges.characters.${b}.story-items`]:1,
    })
    expect(notebookChangeIncrements(entry,entry)).toEqual({'notebookChanges.dm.all':1,'notebookChanges.dm.journal':1,'notebookChanges.room.all':1,'notebookChanges.room.journal':1})
  })
  it('keeps hidden/deleted edits out of player tokens but invalidates deletion and recovery',()=>{
    for(const hidden of [{...entry,audience:'dm'},{...entry,deletedAt:new Date()}])expect(Object.keys(notebookChangeIncrements(hidden,hidden))).toEqual(['notebookChanges.dm.all','notebookChanges.dm.journal'])
    expect(notebookChangeIncrements(entry,{...entry,deletedAt:new Date()})['notebookChanges.room.all']).toBe(1)
    expect(notebookChangeIncrements({...entry,deletedAt:new Date()},entry)['notebookChanges.room.all']).toBe(1)
    const changes={dm:{all:1},room:{all:2},characters:{[a]:{all:3},[b]:{all:4}}}
    const before=notebookChangeIdentity(changes,false,[a],'all')
    changes.dm.all++;changes.characters[b]!.all++
    expect(notebookChangeIdentity(changes,false,[a],'all')).toEqual(before)
    changes.characters[a]!.all++
    expect(notebookChangeIdentity(changes,false,[a],'all')).not.toEqual(before)
  })
  it('leaves folder invalidation to the existing folder read',()=>{
    expect(notebookChangeIncrements(undefined,{...entry,kind:'folder'})).toEqual({})
  })
})
