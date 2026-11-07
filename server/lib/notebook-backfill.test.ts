import {describe, expect, it, vi} from 'vitest'
import {Types, type mongo} from 'mongoose'
import {backfillNotebookListing, certifyNotebookRoom, type NotebookBackfillProgress} from './notebook-backfill'
import {NOTEBOOK_LISTING_VERSION, notebookDerived, notebookDerivedConsistent} from './notebook-derived'

describe('resumable notebook metadata backfill', () => {
  function fixture() {
    const docs = Array.from({length: 3}, (_, i) => ({_id: new Types.ObjectId((i + 1).toString(16).padStart(24, '0')), kind: 'entry', section: 'journal', title: 'Session 2', body: '## Session sources\n- 2. session.', revision: 1, updatedAt: new Date(0), listing: undefined as unknown}))
    let race = true
    const collection = {
      findOne: async (filter: any) => docs.find(d => String(d._id) === String(filter._id)) ?? null,
      find: (filter: any) => {
        let limit = Infinity
        return {sort() {return this}, limit(n: number) {limit = n; return this}, async toArray() {return docs.filter(d => !filter._id || String(d._id) > String(filter._id.$gt)).slice(0, limit).map(d => ({...d}))}}
      },
      updateOne: async (filter: any, update: any) => {
        const doc = docs.find(d => String(d._id) === String(filter._id))!
        if (race && doc === docs[0]) {doc.revision++; doc.body = '## Session sources\n- 9. session.'; race = false}
        if (doc.revision !== filter.revision) return {matchedCount: 0}
        doc.listing = update.$set.listing
        return {matchedCount: 1}
      },
    } as unknown as mongo.Collection
    return {docs, collection}
  }
  it('checks without writes and resumes below the cursor after a racing edit', async () => {
    const {docs, collection} = fixture()
    const initial = structuredClone(docs)
    expect((await backfillNotebookListing(collection)).inconsistent).toBe(3)
    expect(docs).toEqual(initial)
    let progress: NotebookBackfillProgress | undefined
    const first = await backfillNotebookListing(collection, {apply: true, batchSize: 2, maxBatches: 1, checkpoint: async p => {progress = structuredClone(p)}})
    expect(first).toMatchObject({updated: 1, conflicts: 1, complete: false})
    expect(progress?.retryIds).toEqual([String(docs[0]!._id)])
    const resumed = await backfillNotebookListing(collection, {apply: true, batchSize: 2, progress})
    expect(resumed).toMatchObject({updated: 2, complete: true})
    expect(resumed.progress.retryIds).toEqual([])
    expect(docs.every(notebookDerivedConsistent)).toBe(true)
    expect((docs[0]!.listing as any).sessions).toEqual([9])
    expect(docs.map(d => d.updatedAt)).toEqual(initial.map(d => d.updatedAt))
    expect(docs[0]!.revision).toBe(2)
    expect((await backfillNotebookListing(collection, {apply: true})).updated).toBe(0)
  })
})

describe('backfill room certification',()=>{
  function fixture({bad=false,race=false,empty=false}={}) {
    const roomId=new Types.ObjectId(),source={section:'journal',title:'Session 3',body:'text',revision:1}
    const row={...source,_id:new Types.ObjectId(),roomId,kind:'entry',audience:'dm',deletedAt:new Date(),listing:{...notebookDerived(source),type:bad?'objects':'sessions'}}
    const reads:unknown[]=[],writes=vi.fn(async()=>({matchedCount:race?0:1}))
    const entries={find:(filter:any)=>{reads.push(filter);return {sort(){return this},limit(){return this},toArray:async()=>empty||filter._id?[]:[row]}}} as unknown as mongo.Collection
    const rooms={findOne:async()=>({_id:roomId,notebookChanges:{dm:{all:7}}}),updateOne:writes} as unknown as mongo.Collection
    return {roomId,entries,rooms,reads,writes}
  }
  it('certifies only after a fresh complete-room check, including hidden/deleted rows',async()=>{
    const f=fixture()
    expect(await certifyNotebookRoom(f.entries,f.rooms,f.roomId)).toMatchObject({ready:true,reason:'consistent',check:{checked:1,inconsistent:0}})
    expect(f.reads[0]).toEqual({kind:'entry',roomId:f.roomId})
    expect(f.writes).toHaveBeenCalledWith({_id:f.roomId,'notebookChanges.dm.all':7},{$set:{notebookListingVersion:NOTEBOOK_LISTING_VERSION}})
  })
  it('rejects incorrect derived values even when the row version is current',async()=>{
    const f=fixture({bad:true})
    expect(await certifyNotebookRoom(f.entries,f.rooms,f.roomId)).toMatchObject({ready:false,reason:'inconsistent'})
    expect(f.writes).not.toHaveBeenCalled()
  })
  it('does not certify a scan crossed by a concurrent transactional write',async()=>{
    const f=fixture({race:true})
    expect(await certifyNotebookRoom(f.entries,f.rooms,f.roomId)).toMatchObject({ready:false,reason:'concurrent-write'})
  })
  it('can certify empty rooms and uses an existence guard for an unset epoch',async()=>{
    const f=fixture({empty:true})
    f.rooms.findOne=vi.fn(async()=>({_id:f.roomId})) as any
    expect(await certifyNotebookRoom(f.entries,f.rooms,f.roomId)).toMatchObject({ready:true})
    expect(f.writes).toHaveBeenCalledWith({_id:f.roomId,'notebookChanges.dm.all':{$exists:false}},{$set:{notebookListingVersion:NOTEBOOK_LISTING_VERSION}})
  })
})
