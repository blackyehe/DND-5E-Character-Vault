import {beforeEach, describe, expect, it, vi} from 'vitest'
import {Types} from 'mongoose'
const db = vi.hoisted(() => ({find:vi.fn(),findOne:vi.fn(), countDocuments:vi.fn(), aggregate:vi.fn()}))
vi.mock('../models/Notebook', () => ({Notebook: db}))
vi.mock('../env', () => ({env: {NOTEBOOK_DB_LISTING:'off',NOTEBOOK_DB_ROOMS:''}}))
import {env} from '../env'
import {notebookListing, notebookNavigation,notebookDatabaseReady} from './notebook-listing'
import {NOTEBOOK_LISTING_VERSION} from './notebook-derived'
import {Room} from '../models/Room'
import type {LibraryContext} from './room-library-access'
const query={section:'all' as const,type:'all',questStatus:'all',offset:0,folder:'all',deleted:'false' as const,character:'',ids:''}
function context(version?:number) {
  return {room:{_id:new Types.ObjectId(),assignments:[],members:[],notebookListingVersion:version},dm:true,allowed:[],characters:[],folders:new Map()} as unknown as LibraryContext & {folders:Map<string,never>}
}
beforeEach(() => {
  vi.clearAllMocks();env.NOTEBOOK_DB_LISTING='on';env.NOTEBOOK_DB_ROOMS='*'
  const chain:any={select:()=>chain,collation:()=>chain,sort:()=>chain,skip:()=>chain,limit:()=>chain,comment:()=>chain,lean:async()=>[]}
  db.find.mockReturnValue(chain)
  const readiness:any={select:()=>readiness,collation:()=>readiness,comment:()=>readiness,lean:async()=>null};db.findOne.mockReturnValue(readiness)
  db.countDocuments.mockReturnValue({collation:()=>({comment:async()=>0})})
  db.aggregate.mockReturnValue({collation:()=>({option:async()=>[{counts:[],folders:[],tags:[]}]})})
})
describe('room-certified database listing rollout',()=>{
  it('keeps certified and newly-created rooms off until explicitly allowlisted',()=>{
    const canary=context(NOTEBOOK_LISTING_VERSION),other=context(NOTEBOOK_LISTING_VERSION)
    env.NOTEBOOK_DB_ROOMS='';expect(notebookDatabaseReady(canary)).toBe(false)
    env.NOTEBOOK_DB_ROOMS=' '+String(canary.room._id).toUpperCase()+' '
    expect(notebookDatabaseReady(canary)).toBe(true);expect(notebookDatabaseReady(other)).toBe(false)
    env.NOTEBOOK_DB_LISTING='off';expect(notebookDatabaseReady(canary)).toBe(false)
  })
  it('still requires certification with an allowlist or explicit global opt-in',()=>{
    const old=context();env.NOTEBOOK_DB_ROOMS=String(old.room._id);expect(notebookDatabaseReady(old)).toBe(false)
    env.NOTEBOOK_DB_ROOMS='*';expect(notebookDatabaseReady(old)).toBe(false);expect(notebookDatabaseReady(context(NOTEBOOK_LISTING_VERSION))).toBe(true)
  })
  it('does not fabricate readiness while hydrating an existing room',()=>{
    expect(Room.hydrate({_id:new Types.ObjectId()}).notebookListingVersion).toBeUndefined()
  })
  it('defaults the application rollout flag to off',async()=>{
    vi.stubEnv('NOTEBOOK_DB_LISTING',undefined)
    try{expect((await vi.importActual<typeof import('../env')>('../env')).env.NOTEBOOK_DB_LISTING).toBe('off')}
    finally{vi.unstubAllEnvs()}
  })
  it.each([undefined,NOTEBOOK_LISTING_VERSION-1,NOTEBOOK_LISTING_VERSION+1])('falls back without any derived query for marker %s',async version=>{
    expect(await notebookListing(context(version),query,[],[],false)).toBeNull()
    expect(await notebookNavigation(context(version),query,[])).toBeNull()
    expect(db.find).not.toHaveBeenCalled();expect(db.countDocuments).not.toHaveBeenCalled();expect(db.aggregate).not.toHaveBeenCalled()
  })
  it('keeps a ready room on the legacy path when the flag is off',async()=>{
    env.NOTEBOOK_DB_LISTING='off'
    expect(await notebookListing(context(NOTEBOOK_LISTING_VERSION),query,[],[])).toBeNull()
    expect(await notebookNavigation(context(NOTEBOOK_LISTING_VERSION),query,[])).toBeNull()
    expect(db.aggregate).not.toHaveBeenCalled();expect(db.find).not.toHaveBeenCalled()
  })
  it('uses only page and count reads for a certified slim listing',async()=>{
    expect(await notebookListing(context(NOTEBOOK_LISTING_VERSION),query,[],[],false)).toEqual({body:{entries:[],total:0,nextOffset:null}})
    expect(db.find).toHaveBeenCalledOnce();expect(db.countDocuments).toHaveBeenCalledOnce();expect(db.aggregate).not.toHaveBeenCalled()
  })
  it('checks completeness inside the existing navigation facet',async()=>{
    expect(await notebookNavigation(context(NOTEBOOK_LISTING_VERSION),query,[])).not.toBeNull()
    const facet=db.aggregate.mock.calls[0]![0][1].$facet
    expect(Object.keys(facet).sort()).toEqual(['counts','folders','tags','unprepared'])
    expect(db.find).toHaveBeenCalledOnce()
  })
  it('falls back before returning incomplete counts if an unprepared row is outside the page',async()=>{
    db.aggregate.mockReturnValue({collation:()=>({option:async()=>[{unprepared:[{_id:new Types.ObjectId()}],counts:[],folders:[],tags:[]}]})})
    expect(await notebookListing(context(NOTEBOOK_LISTING_VERSION),query,[],[])).toBeNull()
    expect(await notebookNavigation(context(NOTEBOOK_LISTING_VERSION),query,[])).toBeNull();expect(db.find).not.toHaveBeenCalled()
  })
  it('also checks rows excluded by category/session filters for slim pages',async()=>{
    const ready:any={select:()=>ready,collation:()=>ready,comment:()=>ready,lean:async()=>({_id:new Types.ObjectId()})};db.findOne.mockReturnValue(ready)
    expect(await notebookListing(context(NOTEBOOK_LISTING_VERSION),{...query,type:'sessions'},[],[],false)).toBeNull()
    expect(db.findOne.mock.calls[0]![0]).toMatchObject({$and:[{$or:[{'listing.version':{$ne:NOTEBOOK_LISTING_VERSION}},{$expr:{$ne:[{$ifNull:['$listing.sourceRevision',null]},'$revision']}}]}]})
    expect(db.findOne.mock.calls[0]![0]).not.toHaveProperty('listing.type')
  })
  it('preserves player visibility when testing source revision readiness',async()=>{
    const ctx={...context(NOTEBOOK_LISTING_VERSION),dm:false,allowed:['1'.repeat(24)]}
    await notebookListing(ctx,query,[],[],false)
    expect(db.findOne.mock.calls[0]![0]).toMatchObject({$or:[{audience:'room'},{audience:'characters',characterIds:{$in:ctx.allowed}}],$and:[expect.any(Object)]})
  })
})
