/** Numeric driver diagnostics only: bulk error messages can contain documents,
 * index values and connection details, so never include them in request logs. */
export function cacheFailureCodes(error:unknown):{code?:number;writeCodes?:number[];writeConcernCodes?:number[]}{
 if(!error||typeof error!=='object')return {}
 const value=error as Record<string,unknown>
 const numeric=(code:unknown):code is number=>typeof code==='number'&&Number.isSafeInteger(code)
 const codes=(errors:unknown)=>Array.isArray(errors)?[...new Set(errors.flatMap(e=>e&&typeof e==='object'&&numeric(e.code)?[e.code]:[]))].slice(0,8):[]
 const writeCodes=codes(value.writeErrors),writeConcernCodes=codes(value.writeConcernErrors??(value.writeConcernError?[value.writeConcernError]:[]))
 return {...(numeric(value.code)?{code:value.code}:{}),...(writeCodes.length?{writeCodes}:{}),...(writeConcernCodes.length?{writeConcernCodes}:{})}
}
