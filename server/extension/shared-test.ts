// This is the staging service entrypoint only. Ordinary app.ts is unchanged.
import mongoose from 'mongoose'
import ordinaryApp from '../app'
import { connectDb } from '../db'
import { env } from '../env'
import { createExtensionApp } from './api'
import { readSharedTestConfig } from './shared-test-config'
import { createSharedTestApp } from './shared-test-app'

const config = readSharedTestConfig(process.env)
const parsedUri = new URL(env.MONGO_URI)
if (parsedUri.protocol !== 'mongodb+srv:' || parsedUri.pathname !== `/${config.database}` || decodeURIComponent(parsedUri.username) !== config.database || parsedUri.hostname !== process.env.MONGO_HOST) {
  throw new Error('Resolved shared-test database settings do not match the dedicated target.')
}
export default createSharedTestApp(config, ordinaryApp, async () => {
  await connectDb()
  if (mongoose.connection.name !== config.database) throw new Error('Unexpected shared-test database connection.')
  return createExtensionApp({ websiteOrigin: config.websiteOrigin, extensionOrigins: [config.extensionOrigin], rememberedConnections: config.rememberedConnections })
})
