import {describe,it,expect} from 'vitest'
import {newOptionDraft,restoreOptionDraft} from './option-workshop'
describe('device option draft recovery',()=>{
 it('restores an unfinished draft with independent copies of unsaved form values',()=>{const draft=newOptionDraft('feats');draft.body.description='Work in progress';const restored=restoreOptionDraft(JSON.parse(JSON.stringify(draft)));expect(restored.body.name).toBe('');expect(restored.body.description).toBe('Work in progress');restored.body.description='Changed';expect(draft.body.description).toBe('Work in progress')})
 it('rejects corrupt nested fields and future formats without modifying the input',()=>{const draft=newOptionDraft('backgrounds');for(const bad of [{...draft,version:2},{...draft,body:{...draft.body,options:null}},{...draft,body:{...draft.body,description:42}},{...draft,published:{revision:1,index:'x',packId:'foreign',packHash:'bad'}}]){const original=JSON.stringify(bad);expect(()=>restoreOptionDraft(bad)).toThrow();expect(JSON.stringify(bad)).toBe(original)}})
})
