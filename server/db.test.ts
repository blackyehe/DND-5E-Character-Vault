import {beforeEach,expect,it,vi} from 'vitest'
const mocks=vi.hoisted(()=>({connect:vi.fn(),getClient:vi.fn(()=>({})),state:{readyState:0},env:{MONGO_URI:'mongodb://127.0.0.1/fixture',NODE_ENV:'production'}}))
vi.mock('mongoose',()=>({default:{connect:mocks.connect,connection:{get readyState(){return mocks.state.readyState},getClient:mocks.getClient}}}))
vi.mock('./env',()=>({env:mocks.env}))
vi.mock('./middleware/request-timing',()=>({observeTimingClient:vi.fn(),requestTimingEnabled:()=>true}))
beforeEach(()=>{vi.resetModules();mocks.connect.mockReset().mockResolvedValue({});mocks.env.NODE_ENV='production';mocks.state.readyState=0})
it('keeps automatic collection/index setup out of production connections',async()=>{
 const {connectDb}=await import('./db');await connectDb()
 expect(mocks.connect).toHaveBeenCalledWith(mocks.env.MONGO_URI,expect.objectContaining({autoCreate:false,autoIndex:false,monitorCommands:true,maxPoolSize:10,minPoolSize:0}))
})
it('retains automatic storage setup for development and test databases',async()=>{
 mocks.env.NODE_ENV='development';const {connectDb}=await import('./db');await connectDb()
 expect(mocks.connect).toHaveBeenCalledWith(mocks.env.MONGO_URI,expect.objectContaining({autoCreate:true,autoIndex:true}))
})
it('shares an in-progress connection between simultaneous requests and reuses a ready connection',async()=>{
 let resolve!:(value:unknown)=>void;mocks.connect.mockReturnValue(new Promise(r=>{resolve=r}))
 const {connectDb}=await import('./db');const a=connectDb(),b=connectDb();expect(mocks.connect).toHaveBeenCalledTimes(1)
 resolve({});await Promise.all([a,b]);mocks.state.readyState=1;await connectDb();expect(mocks.connect).toHaveBeenCalledTimes(1)
})
it('allows a fresh connection after an initial connection failure',async()=>{
 mocks.connect.mockRejectedValueOnce(Error('temporary failure'));const {connectDb}=await import('./db')
 await expect(connectDb()).rejects.toThrow('temporary failure');await connectDb();expect(mocks.connect).toHaveBeenCalledTimes(2)
})
