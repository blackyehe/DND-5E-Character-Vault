import app from './app'
import { env } from './env'
import { connectDb } from './db'

async function main() {
  await connectDb()
  app.listen(env.PORT, () => {
    console.log(`API listening on http://localhost:${env.PORT}`)
  })
}

main().catch(() => {
  console.error('Failed to start server. Check database connectivity and environment settings.')
  process.exit(1)
})
