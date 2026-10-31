import {expect,it} from 'vitest'
import {parsedPack,cachedParsedPack} from './orcbrew-library'
import {sourceHash} from './orcbrew'
it('returns only an already parsed exact source hash without interpreting unrelated values',()=>{
 const source='{:orcpub.dnd.e5/feats {:resident-proof {:name "Resident proof" :description "Exact source"}}}',parsed=parsedPack({source})
 expect(cachedParsedPack(sourceHash(source))).toBe(parsed)
 expect(cachedParsedPack(sourceHash(source+' changed'))).toBeUndefined()
 expect(cachedParsedPack(undefined)).toBeUndefined()
 expect(parsedPack({source})).toBe(parsed)
})
