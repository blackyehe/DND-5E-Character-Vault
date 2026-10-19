import mongoose from 'mongoose'
import { env } from './env'

let pending: Promise<typeof mongoose> | undefined
export async function connectDb() {
  if (mongoose.connection.readyState === 1) return
  if (!pending) pending = mongoose.connect(env.MONGO_URI, { maxPoolSize: 10, minPoolSize: 0, serverSelectionTimeoutMS: 8000,connectTimeoutMS:8000,socketTimeoutMS:15000,waitQueueTimeoutMS:8000,compressors:['zlib'],zlibCompressionLevel:6 }).catch(error => { pending = undefined; throw error })
  await pending
}
