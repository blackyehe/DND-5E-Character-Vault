import { MongoClient, BSON } from 'mongodb'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const [filename, email] = process.argv.slice(2)
const passwordFile = process.env.ATLAS_PASSWORD_FILE
const savedPassword = passwordFile ? (await readFile(resolve(passwordFile), 'utf8')).trim() : undefined
const uri = process.env.TARGET_MONGO_URI ?? (savedPassword ? `mongodb+srv://codex_app:${encodeURIComponent(savedPassword)}@codex-heroes.z3jozyr.mongodb.net/dnd_site?retryWrites=true&w=majority&authSource=admin` : undefined)
if (!filename || !email || !uri?.startsWith('mongodb+srv://')) throw new Error('Supply a backup filename and the new DM account email; set TARGET_MONGO_URI securely in the environment.')
const backup = BSON.EJSON.parse(await readFile(filename, 'utf8'))
if (backup.format !== 'codex-public-migration' || backup.version !== 1 || !Array.isArray(backup.characters) || !Array.isArray(backup.content)) throw new Error('This file is not a supported content backup.')
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 })
try {
  await client.connect()
  const db = client.db(), owner = await db.collection('users').findOne({ email: email.trim().toLowerCase() }, { projection: { _id: 1 } })
  if (!owner) throw new Error('The new DM must register on the public website first.')
  if (await db.collection('characters').countDocuments({ userId: owner._id }) || await db.collection('customcontents').countDocuments({ userId: owner._id })) throw new Error('The destination account already has content; stop to avoid duplicate imports or overwrites.')
  if (await db.collection('characters').countDocuments({ _id: { $in: backup.characters.map((c: {_id: unknown}) => c._id) } }) || await db.collection('customcontents').countDocuments({ _id: { $in: backup.content.map((c: {_id: unknown}) => c._id) } })) throw new Error('Some source IDs already exist at the destination. No content was overwritten.')
  const session = client.startSession()
  try {
    await session.withTransaction(async () => {
      if (backup.characters.length) await db.collection('characters').insertMany(backup.characters.map((c: Record<string, unknown>) => ({ ...c, userId: owner._id })), { session })
      if (backup.content.length) await db.collection('customcontents').insertMany(backup.content.map((c: Record<string, unknown>) => ({ ...c, userId: owner._id })), { session })
    })
  } finally { await session.endSession() }
  console.log(JSON.stringify({ migratedCharacters: backup.characters.length, migratedContentEntries: backup.content.length, localDataUnchanged: true, passwordsMigrated: false }))
} catch (error) { console.error(error instanceof Error && !error.message.includes('mongodb') ? error.message : 'Migration failed. Check secure database configuration and access.'); process.exitCode = 1 }
finally { await client.close() }
