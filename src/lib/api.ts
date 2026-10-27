import {MAP_UPLOAD_JSON_BYTES} from '../../shared/room-maps'

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  if (typeof options.body === 'string') {
    const bytes = new Blob([options.body]).size
    const mapUpload = options.method === 'POST' && /^\/api\/rooms\/[a-f0-9]{24}\/maps(?:\?[^#]*)?$/i.test(path)
    if (mapUpload && bytes > MAP_UPLOAD_JSON_BYTES) throw new ApiError(413, 'Prepare this map to 3 MiB or less before uploading.')
    if (bytes > 2 * 1024 * 1024 && !path.startsWith('/api/uploads') && !mapUpload) return largeRequest<T>(path, options)
  }
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...options,
  }).catch(error=>{if(options.signal?.aborted)throw new Error('The connection is taking too long. Please try Refresh.');throw error})
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {
      /* ignore */
    }
    throw new ApiError(res.status, message)
  }
  return res.json().catch(error=>{if(options.signal?.aborted)throw new Error('The connection is taking too long. Please try Refresh.');throw error}) as Promise<T>
}

async function largeRequest<T>(path: string, options: RequestInit): Promise<T> {
  const bytes = new TextEncoder().encode(options.body as string), chunkSize = 768 * 1024
  const upload = await request<{id:string}>('/api/uploads', {method:'POST',body:JSON.stringify({path,method:options.method,bytes:bytes.length,parts:Math.ceil(bytes.length/chunkSize)})})
  try {
    for (let offset = 0, index = 0; offset < bytes.length; offset += chunkSize, index++) {
      const chunk = bytes.subarray(offset,offset+chunkSize)
      let binary = ''
      for (let i=0;i<chunk.length;i+=32768) binary += String.fromCharCode(...chunk.subarray(i,i+32768))
      await request(`/api/uploads/${upload.id}/parts/${index}`, {method:'POST',body:JSON.stringify({data:btoa(binary)})})
    }
    return await request<T>(path, {...options, body:'{}', headers:{'Content-Type':'application/json','x-codex-upload':upload.id}})
  } finally { await request(`/api/uploads/${upload.id}`, {method:'DELETE'}).catch(()=>{}) }
}

export const api = {
  get: <T>(path: string,options:{timeoutMs?:number;signal?:AbortSignal}={}) => request<T>(path,{signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(options.timeoutMs??15000)]):AbortSignal.timeout(options.timeoutMs??15000)}),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path:string,body:unknown)=>request<T>(path,{method:'PUT',body:JSON.stringify(body)}),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
