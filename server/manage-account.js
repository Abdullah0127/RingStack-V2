import { openDatabase } from './db.js'

const [role, emailValue, status] = process.argv.slice(2)
const roles = new Set(['advertiser', 'publisher'])
const statuses = new Set(['approved', 'rejected', 'suspended'])
if (!roles.has(role) || !emailValue || !statuses.has(status)) {
  console.error('Usage: npm run account:status -- <advertiser|publisher> <email> <approved|rejected|suspended>')
  process.exitCode = 1
} else {
  const db = openDatabase()
  const email = emailValue.trim().toLowerCase()
  const account = db.prepare('SELECT id, role, email, full_name FROM accounts WHERE role = ? AND email = ?').get(role, email)
  if (!account) {
    console.error('No matching account was found.')
    process.exitCode = 1
  } else {
    db.exec('BEGIN IMMEDIATE')
    try {
      db.prepare('UPDATE accounts SET status = ?, updated_at = ? WHERE id = ?').run(status, Date.now(), account.id)
      if (status !== 'approved') db.prepare('DELETE FROM sessions WHERE account_id = ?').run(account.id)
      db.prepare('DELETE FROM password_reset_tokens WHERE account_id = ?').run(account.id)
      db.exec('COMMIT')
      console.log(`${account.role} account ${account.email} is now ${status}.`)
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    } finally {
      db.close()
    }
  }
  if (db.isOpen) db.close()
}
