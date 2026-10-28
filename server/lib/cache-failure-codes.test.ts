import {describe,it,expect} from 'vitest'
import {cacheFailureCodes} from './cache-failure-codes'
describe('cache failure diagnostics',()=>{
 it('extracts numeric bulk/concern codes without retaining errors, keys, operations or credentials',()=>{
  const secret='mongodb://private-user:private-password@private-host/database'
  const error={code:8000,message:secret,keyValue:{userId:'private-owner'},writeErrors:[{code:11000,errmsg:secret,op:{payload:'private-document'}},{code:11000},{code:13}],writeConcernErrors:[{code:64,errmsg:secret}]}
  expect(cacheFailureCodes(error)).toEqual({code:8000,writeCodes:[11000,13],writeConcernCodes:[64]})
  expect(JSON.stringify(cacheFailureCodes(error))).not.toMatch(/private|mongodb|message|payload|userId/)
 })
 it('bounds code lists and ignores arbitrary string codes or non-error values',()=>{
  expect(cacheFailureCodes({code:'private-message',writeErrors:Array.from({length:40},(_,code)=>({code})),writeConcernError:{code:64}})).toEqual({writeCodes:[0,1,2,3,4,5,6,7],writeConcernCodes:[64]})
  expect(cacheFailureCodes(null)).toEqual({});expect(cacheFailureCodes(Error('private-message'))).toEqual({})
 })
})
