import { mkdirSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { DatabaseSync } from 'node:sqlite'

function isWithin(parent, child) {
  const path = relative(parent, child)
  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path))
}

export function openDatabase(databasePath = process.env.AUTH_DB_PATH || 'data/ringstack.sqlite') {
  const resolvedPath = databasePath === ':memory:' ? databasePath : resolve(databasePath)
  if (resolvedPath !== ':memory:' && [resolve('public'), resolve('dist')].some((directory) => isWithin(directory, resolvedPath))) {
    throw new Error('AUTH_DB_PATH must be outside public and dist directories.')
  }
  if (resolvedPath !== ':memory:') mkdirSync(dirname(resolvedPath), { recursive: true })

  const db = new DatabaseSync(resolvedPath)
  db.exec(`
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      role TEXT NOT NULL CHECK (role IN ('advertiser', 'publisher')),
      email TEXT NOT NULL,
      full_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
      profile_json TEXT NOT NULL CHECK (json_valid(profile_json)),
      terms_version TEXT NOT NULL,
      terms_accepted_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE (role, email)
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_account_id ON sessions(account_id);
    CREATE INDEX IF NOT EXISTS sessions_expiration ON sessions(expires_at);

    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      token_hash TEXT PRIMARY KEY,
      account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS password_reset_account_id ON password_reset_tokens(account_id);
    CREATE INDEX IF NOT EXISTS password_reset_expiration ON password_reset_tokens(expires_at);

    CREATE TABLE IF NOT EXISTS offers (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      campaign_type TEXT NOT NULL CHECK (campaign_type IN ('CPA', 'CPL')),
      industry TEXT NOT NULL,
      vertical TEXT NOT NULL,
      product_type TEXT NOT NULL
        CHECK (product_type IN ('Inbound Call', 'Traffic', 'Live Transfer', 'Form Fill')),
      payment_terms TEXT,
      payout_method TEXT,
      payout_amount REAL,
      payout_currency TEXT NOT NULL DEFAULT 'USD',
      states_json TEXT NOT NULL CHECK (json_valid(states_json)),
      schedule TEXT,
      percentage REAL,
      buffer_seconds INTEGER,
      available_from TEXT,
      description TEXT,
      qualification_requirements TEXT,
      traffic_requirements TEXT,
      restrictions_json TEXT NOT NULL CHECK (json_valid(restrictions_json)),
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
      is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS offers_status_created ON offers(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS offers_facets ON offers(campaign_type, product_type, industry, vertical);

    CREATE TABLE IF NOT EXISTS offer_applications (
      id TEXT PRIMARY KEY,
      offer_id TEXT NOT NULL REFERENCES offers(id),
      publisher_id TEXT NOT NULL REFERENCES accounts(id),
      status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),
      message TEXT NOT NULL DEFAULT '',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE (offer_id, publisher_id)
    );
    CREATE INDEX IF NOT EXISTS offer_applications_publisher ON offer_applications(publisher_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS offer_applications_offer ON offer_applications(offer_id, status);

    CREATE TABLE IF NOT EXISTS offer_audit_log (
      id TEXT PRIMARY KEY,
      offer_id TEXT NOT NULL REFERENCES offers(id),
      action TEXT NOT NULL CHECK (action IN ('created', 'updated')),
      previous_status TEXT,
      next_status TEXT NOT NULL CHECK (next_status IN ('active', 'paused')),
      actor TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS offer_audit_offer_date ON offer_audit_log(offer_id, created_at DESC);
  `)

  const offerColumns = new Set(
    db.prepare('PRAGMA table_info(offers)').all().map((column) => column.name),
  )
  if (!offerColumns.has('image')) db.exec('ALTER TABLE offers ADD COLUMN image TEXT')
  if (!offerColumns.has('requirements_json')) {
    db.exec("ALTER TABLE offers ADD COLUMN requirements_json TEXT NOT NULL DEFAULT '[]' CHECK (json_valid(requirements_json))")
  }

  return db
}
