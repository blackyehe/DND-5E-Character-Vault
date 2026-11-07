import mongoose from 'mongoose'
import { env } from './env'
import {observeTimingClient, requestTimingEnabled} from './middleware/request-timing'

let pending: Promise<typeof mongoose> | undefined
export async function connectDb() {
  if (mongoose.connection.readyState === 1) {observeTimingClient(mongoose.connection.getClient()); return}
  // Production collections/indexes are prepared before release. Repeating their
  // setup on each serverless start adds work alongside the first user reads.
  if (!pending) pending = mongoose.connect(env.MONGO_URI, { autoCreate: env.NODE_ENV !== 'production', autoIndex: env.NODE_ENV !== 'production', monitorCommands: requestTimingEnabled(), maxPoolSize: 10, minPoolSize: 0, serverSelectionTimeoutMS: 8000,connectTimeoutMS:8000,socketTimeoutMS:15000,waitQueueTimeoutMS:8000,compressors:['zlib'],zlibCompressionLevel:6 }).catch(error => { pending = undefined; throw error })
  await pending
  observeTimingClient(mongoose.connection.getClient())
}
