import {afterEach,expect,it,vi} from 'vitest'
import {notebookPlanSummary} from './notebook-preflight'
import {main} from '../scripts/notebook-preflight'
afterEach(()=>vi.unstubAllEnvs())
it('reports only the winning/executed plan, without mistaking rejected SORT alternatives for a blocking sort',()=>{
 const value={queryPlanner:{winningPlan:{stage:'FETCH',inputStage:{stage:'IXSCAN',indexName:'covered'}},rejectedPlans:[{stage:'SORT'}]},executionStats:{nReturned:60,totalDocsExamined:60,totalKeysExamined:60,executionStages:{stage:'FETCH'}}}
 expect(notebookPlanSummary(value)).toMatchObject({blockingSort:false,indexes:['covered'],returned:60,docsExamined:60,keysExamined:60})
 expect(notebookPlanSummary({queryPlanner:{winningPlan:{stage:'SHARD_MERGE',shards:[{winningPlan:{stage:'IXSCAN'},rejectedPlans:[{stage:'SORT'}]}]}}}).blockingSort).toBe(false)
})
it('reports an actual executed blocking sort',()=>{
 expect(notebookPlanSummary({queryPlanner:{winningPlan:{queryPlan:{stage:'SORT',inputStage:{stage:'IXSCAN',indexName:'filtered'}}}},executionStats:{executionTimeMillis:12}})).toMatchObject({blockingSort:true,indexes:['filtered'],executionMs:12})
})
it('has no apply mode and requires an explicit room and private connection rather than a default database',async()=>{
 vi.stubEnv('MONGO_URI',undefined);vi.stubEnv('MONGODB_URI',undefined)
 await expect(main(['--apply'])).rejects.toThrow('no apply mode')
 await expect(main(['--room='+'1'.repeat(24)])).rejects.toThrow('private connection')
 await expect(main([])).rejects.toThrow('explicit room')
 vi.stubEnv('MONGO_URI','mongodb://127.0.0.1:1/?authSource=admin')
 await expect(main(['--room='+'1'.repeat(24)])).rejects.toThrow('explicit database name')
})
