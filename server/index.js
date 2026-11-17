import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRingstackServer } from './app.js'
import { openDatabase } from './db.js'
import { createPasswordResetMailer } from './mailer.js'
import { seedDevelopmentOffers } from './dev-offers.js'

const production = process.env.NODE_ENV === 'production'
const publicOrigin = process.env.PUBLIC_ORIGIN || ''
if (production) {
  if (!publicOrigin || new URL(publicOrigin).origin !== publicOrigin || new URL(publicOrigin).protocol !== 'https:') {
    throw new Error('Set PUBLIC_ORIGIN to the HTTPS origin used by the production website.')
  }
  if (!process.env.SMTP_URL || !process.env.SMTP_FROM) {
    throw new Error('Set SMTP_URL and SMTP_FROM to enable secure password-reset email delivery.')
  }
}

const staticDirectory = production
  ? resolve(fileURLToPath(new URL('../dist/', import.meta.url)))
  : undefined
if (production && !existsSync(resolve(staticDirectory, 'index.html'))) {
  throw new Error('Build the frontend with npm run build before starting the production server.')
}

const db = openDatabase()
if (!production) seedDevelopmentOffers(db)
const server = createRingstackServer({
  db,
  sendPasswordResetEmail: createPasswordResetMailer(),
  publicOrigin: publicOrigin || undefined,
  production,
  trustProxy: process.env.TRUST_PROXY === 'true',
  staticDirectory,
})
const port = Number(process.env.API_PORT || process.env.PORT || 3001)

server.listen(port, '0.0.0.0', () => {
  console.log(`Ringstack API listening on http://localhost:${port}`)
})

function shutdown() {
  server.close(() => {
    db.close()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
