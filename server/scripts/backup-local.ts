import { MongoClient, BSON } from 'mongodb'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const email = process.argv[2]?.trim().toLowerCase()
if (!email) throw new Error('Supply the local owner email. No database passwords should be passed as arguments.')
const client = new MongoClient(process.env.LOCAL_MONGO_URI ?? 'mongodb://localhost:27017/dnd_site', { serverSelectionTimeoutMS: 8000 })
try {
  await client.connect()
  const db = client.db(), user = await db.collection('users').findOne({ email }, { projection: { _id: 1 } })
  if (!user) throw new Error('The local owner was not found.')
  const characters = await db.collection('characters').find({ userId: user._id }).toArray()
  const content = await db.collection('customcontents').find({ userId: user._id }).toArray()
  const directory = resolve(import.meta.dirname, '../../backups')
  await mkdir(directory, { recursive: true })
  const filename = resolve(directory, `content-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
  const data = BSON.EJSON.stringify({ format: 'codex-public-migration', version: 1, exportedAt: new Date(), sourceUserId: user._id, characters, content }, { relaxed: false })
  await writeFile(filename, data, { encoding: 'utf8', flag: 'wx' })
  console.log(JSON.stringify({ backup: filename, characters: characters.length, contentPacksAndEntries: content.length, bytes: Buffer.byteLength(data), credentialsIncluded: false }))
} catch { console.error('Content backup failed. Check local database access and the owner email.'); process.exitCode = 1 }
finally { await client.close() }
