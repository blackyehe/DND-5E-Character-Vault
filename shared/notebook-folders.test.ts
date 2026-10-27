import {describe,it,expect} from 'vitest'
import {audienceAllows,folderDescendants,validFolderParent,notebookFolderRows,type FolderAccess} from './notebook-folders'
import type {NotebookFolder} from './notebook'
const folder=(id:string,parentId:string|null=null,extra:Partial<FolderAccess>={}):FolderAccess=>({id,parentId,section:'journal',deletedAt:null,audience:'room',characterIds:[],...extra})
describe('notebook folder hierarchy and entry privacy',()=>{
  it('keeps entry audience independent of folder organization',()=>{
    expect(audienceAllows({audience:'room'},[])).toBe(true)
    expect(audienceAllows({audience:'characters',characterIds:['fade']},['fade'])).toBe(true)
    expect(audienceAllows({audience:'characters',characterIds:['fade']},['volenta'])).toBe(false)
    expect(audienceAllows({audience:'dm'},['fade'])).toBe(false)
  })
  it('rejects deleted, missing, cyclic, and cross-section parent selections',()=>{
    for(const values of [[folder('child','missing')],[folder('child','parent'),folder('parent',null,{deletedAt:'now'})],[folder('child','parent'),folder('parent','child')],[folder('child','parent'),folder('parent',null,{section:'story-items'})]])expect(validFolderParent(null,'child','journal',new Map(values.map(f=>[f.id,f])))).toBe(false)
  })
  it('rejects self/descendant and unavailable parents while allowing deeper hierarchies',()=>{
    const folders=new Map([folder('root'),folder('child','root'),folder('other',null,{section:'story-items'})].map(f=>[f.id,f]))
    expect(validFolderParent('root','child','journal',folders)).toBe(false)
    expect(validFolderParent('root','root','journal',folders)).toBe(false)
    expect(validFolderParent(null,'other','journal',folders)).toBe(false)
    expect(validFolderParent(null,'missing','journal',folders)).toBe(false)
    expect(validFolderParent('child',null,'journal',folders)).toBe(true)
    for(let i=0;i<21;i++)folders.set(String(i),folder(String(i),i?String(i-1):null))
    expect(validFolderParent(null,'20','journal',folders)).toBe(true)
  })
  it('builds complete descendant selections and ordered, unambiguous folder paths',()=>{
    const folders=[folder('shop','city'),folder('country'),folder('city','country'),folder('other')]
    expect([...folderDescendants('country',folders)].sort()).toEqual(['city','country','shop'])
    const rows=notebookFolderRows(folders.map(f=>({...f,title:f.id,revision:1,count:0,deletedAt:null,section:'journal'} as NotebookFolder)))
    expect(rows.map(r=>[r.path,r.depth])).toEqual([['country',0],['country / city',1],['country / city / shop',2],['other',0]])
  })
})
