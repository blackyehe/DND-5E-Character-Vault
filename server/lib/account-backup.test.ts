import {describe,it,expect} from 'vitest'
import {mongo,Types} from 'mongoose'
import {gzipSync} from 'node:zlib'
import {createHash} from 'node:crypto'
import {decodeAccountBackup,restoreAccountBackup} from './account-backup'
import {BACKUP_EXPANDED_BYTES,remapBackupReferences} from '../../shared/account-backup'

const id='a'.repeat(24),next='b'.repeat(24)
const payload=()=>({accountId:new Types.ObjectId(id),characters:[],content:[],characterLibrary:null,rooms:[],notes:[],history:[],maps:[],assets:[],cities:[]})
function archive(p:any){const bytes=Buffer.from(mongo.BSON.EJSON.stringify(p,{relaxed:true}));return{format:'codex-of-heroes-backup',version:2,encoding:'gzip-base64',bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),payload:gzipSync(bytes).toString('base64'),summary:{characters:p.characters.length,content:p.content.length,rooms:p.rooms.length,notes:p.notes.length,history:p.history.length,maps:p.maps.length,cities:p.cities.length,characterFolders:0}}}
describe('portable campaign backup validation',()=>{
 it('decodes checksummed BSON dates/IDs/binary without losing bytes',()=>{const p:any=payload();p.content=[{_id:new Types.ObjectId(next),data:{bytes:new mongo.Binary(Buffer.from([0,1,255])),when:new Date('2026-11-03')}}];const b=archive(p),decoded=decodeAccountBackup(b);expect(String(decoded.accountId)).toBe(id);expect(decoded.content[0]!.data.when).toEqual(p.content[0].data.when);expect(Buffer.from(decoded.content[0]!.data.bytes.value())).toEqual(Buffer.from([0,1,255]))})
 it('rejects changed bytes, inconsistent counts, unsafe sizes and malformed compression',()=>{const b=archive(payload());for(const bad of [{...b,sha256:'0'.repeat(64)},{...b,summary:{...b.summary,notes:1}},{...b,bytes:BACKUP_EXPANDED_BYTES+1},{...b,payload:'AAAA'},{...b,payload:'AA=A'}])expect(()=>decodeAccountBackup(bad)).toThrow()})
 it('rejects duplicate IDs and missing campaign images before opening a transaction',async()=>{const p:any=payload();p.characters=[{_id:new Types.ObjectId(id)},{_id:new Types.ObjectId(id)}];await expect(restoreAccountBackup(next,archive(p))).rejects.toThrow('duplicate');p.characters=[];p.rooms=[{_id:new Types.ObjectId(id)}];p.maps=[{_id:new Types.ObjectId(next),roomId:new Types.ObjectId(id)}];await expect(restoreAccountBackup(next,archive(p))).rejects.toThrow('image is missing')})
 it('remaps references and live note links while preserving source, prose and code examples',()=>{const ids=new Map([[id,next]]),body=`See [[${id}#part|Note]] and [note](note:${id}).\n\`[[${id}]]\`\n\`\`\`\n[[${id}]]\n\`\`\``
  const actual=remapBackupReferences({title:id,source:'homebrew-'+id+'-source',body,relatedIds:[id],templateId:id,index:'homebrew-'+id+'-legacy'},ids,true)
  expect(actual.title).toBe(id);expect(actual.source).toBe('homebrew-'+id+'-source');expect(actual.relatedIds).toEqual([next]);expect(actual.templateId).toBe(next);expect(actual.index).toBe('homebrew-'+next+'-legacy');expect(remapBackupReferences('workshop-item-'+id,ids)).toBe('workshop-item-'+next);expect(actual.body).toContain(`[[${next}#part|Note]]`);expect(actual.body).toContain(`](note:${next})`);expect(actual.body).toContain(`\`[[${id}]]\``);expect(actual.body).toContain(`\n[[${id}]]\n`)
 })
})
