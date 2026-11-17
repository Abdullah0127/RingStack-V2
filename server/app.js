import { createServer } from 'node:http'
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { createReadStream, existsSync, statSync } from 'node:fs'
import { extname, isAbsolute, relative, resolve, sep } from 'node:path'
import { campaignTypes, offerIndustries, offerVerticals, productTypes } from '../shared/offerFacets.js'

const scrypt = promisify(scryptCallback)
const passwordCost = 32768
const passwordBlockSize = 8
const passwordParallelism = 1
const passwordBytes = 64
const bodyLimit = 32 * 1024
const sessionDuration = 12 * 60 * 60 * 1000
const rememberedSessionDuration = 30 * 24 * 60 * 60 * 1000
const resetDuration = 60 * 60 * 1000
const allowedRoles = new Set(['advertiser', 'publisher'])
const teamSizes = new Set(['1', '2-5', '5-25', '25+'])
const verticals = new Set(['insurance', 'financial-services', 'home-services', 'legal', 'travel', 'real-estate'])
const publisherVolumes = new Set(['under-100', '100-1000', 'over-1000', 'not-sure'])
const publisherSources = new Set(['owned-website', 'paid-search', 'paid-social', 'call-centre', 'other'])
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2',
}

class HttpError extends Error {
  constructor(status, code, message, headers = {}) {
    super(message)
    this.status = status
    this.code = code
    this.headers = headers
  }
}

function hashToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const derived = await scrypt(password, salt, passwordBytes, {
    N: passwordCost,
    r: passwordBlockSize,
    p: passwordParallelism,
    maxmem: 64 * 1024 * 1024,
  })
  return `scrypt$${passwordCost}$${passwordBlockSize}$${passwordParallelism}$${salt.toString('base64url')}$${derived.toString('base64url')}`
}

export async function verifyPassword(password, encodedHash) {
  const [algorithm, cost, blockSize, parallelism, saltValue, hashValue] = encodedHash.split('$')
  if (algorithm !== 'scrypt' || !saltValue || !hashValue) return false
  const expected = Buffer.from(hashValue, 'base64url')
  if (expected.length !== passwordBytes) return false
  const actual = await scrypt(password, Buffer.from(saltValue, 'base64url'), expected.length, {
    N: Number(cost),
    r: Number(blockSize),
    p: Number(parallelism),
    maxmem: 64 * 1024 * 1024,
  })
  return timingSafeEqual(expected, actual)
}

function sendJson(res, status, value, headers = {}) {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...headers,
  })
  res.end(body)
}

function sendError(res, error) {
  if (error instanceof HttpError) {
    sendJson(res, error.status, { error: error.code, message: error.message }, error.headers)
    return
  }
  console.error(`[auth] Unexpected request failure: ${error?.name || 'Error'}: ${error?.message || 'Unknown error'}`)
  sendJson(res, 500, { error: 'internal_error', message: 'We could not complete that request. Please try again.' })
}

async function readJson(req) {
  const contentType = req.headers['content-type'] || ''
  if (!contentType.toLowerCase().startsWith('application/json')) {
    throw new HttpError(415, 'json_required', 'Send the request as JSON.')
  }
  const chunks = []
  let length = 0
  for await (const chunk of req) {
    length += chunk.length
    if (length > bodyLimit) throw new HttpError(413, 'request_too_large', 'The submitted form is too large.')
    chunks.push(chunk)
  }
  try {
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Expected an object.')
    return body
  } catch {
    throw new HttpError(400, 'invalid_json', 'The submitted data is not valid JSON.')
  }
}

function requestIp(req, trustProxy) {
  if (trustProxy && typeof req.headers['x-forwarded-for'] === 'string') {
    const forwarded = req.headers['x-forwarded-for'].split(',')[0].trim()
    if (forwarded) return forwarded.slice(0, 64)
  }
  return req.socket.remoteAddress || 'unknown'
}

function createRateLimiter(now) {
  const buckets = new Map()
  let operations = 0
  return (key, limit, windowMs) => {
    const currentTime = now()
    let bucket = buckets.get(key)
    if (!bucket || currentTime >= bucket.expiresAt) {
      bucket = { count: 0, expiresAt: currentTime + windowMs }
      buckets.set(key, bucket)
    }
    if (bucket.count >= limit) {
      const retryAfter = Math.max(1, Math.ceil((bucket.expiresAt - currentTime) / 1000))
      throw new HttpError(429, 'rate_limited', 'Too many attempts. Wait a little while and try again.', {
        'Retry-After': String(retryAfter),
      })
    }
    bucket.count += 1
    operations += 1
    if (operations % 256 === 0) {
      for (const [bucketKey, value] of buckets) {
        if (currentTime >= value.expiresAt) buckets.delete(bucketKey)
      }
    }
  }
}

function validateOrigin(req, publicOrigin) {
  const origin = req.headers.origin
  let expectedOrigin = publicOrigin
  if (!expectedOrigin) {
    const protocol = req.socket.encrypted ? 'https' : 'http'
    expectedOrigin = `${protocol}://${req.headers.host || ''}`
  }
  if (typeof origin !== 'string' || origin !== expectedOrigin) {
    throw new HttpError(403, 'origin_not_allowed', 'This request did not come from Ringstack.')
  }
}

function parseCookies(value = '') {
  const result = {}
  for (const part of value.split(';')) {
    const separator = part.indexOf('=')
    if (separator <= 0) continue
    result[part.slice(0, separator).trim()] = part.slice(separator + 1).trim()
  }
  return result
}

function cookieName(production) {
  return production ? '__Host-ringstack_session' : 'ringstack_session'
}

function sessionCookie(token, production, maxAge) {
  const parts = [`${cookieName(production)}=${token}`, 'Path=/', 'HttpOnly', 'SameSite=Lax']
  if (production) parts.push('Secure')
  if (maxAge) parts.push(`Max-Age=${maxAge}`)
  return parts.join('; ')
}

function expiredCookie(production) {
  return `${cookieName(production)}=; Path=/; HttpOnly; SameSite=Lax${production ? '; Secure' : ''}; Max-Age=0`
}

function cleanText(value, field, { required = true, max = 160 } = {}) {
  if (typeof value !== 'string') {
    if (!required && (value === undefined || value === null)) return ''
    throw new HttpError(400, 'invalid_field', `${field} is required.`)
  }
  const normalized = value.trim()
  if (required && !normalized) throw new HttpError(400, 'invalid_field', `${field} is required.`)
  if (normalized.length > max) throw new HttpError(400, 'invalid_field', `${field} is too long.`)
  return normalized
}

function cleanEmail(value) {
  const email = cleanText(value, 'Email', { max: 254 }).toLowerCase()
  if (!emailPattern.test(email)) throw new HttpError(400, 'invalid_email', 'Enter a valid email address.')
  return email
}

function cleanPassword(value) {
  if (typeof value !== 'string' || value.length < 12 || value.length > 128) {
    throw new HttpError(400, 'invalid_password', 'Choose a password between 12 and 128 characters.')
  }
  return value
}

function cleanWebsite(value) {
  const website = cleanText(value, 'Website', { required: false, max: 2048 })
  if (!website) return ''
  try {
    const parsed = new URL(website)
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) throw new Error('Invalid URL.')
    return parsed.href
  } catch {
    throw new HttpError(400, 'invalid_website', 'Enter a valid website address beginning with http:// or https://.')
  }
}

function validateRegistration(role, body) {
  const firstName = cleanText(body.firstName, 'First name', { max: 80 })
  const lastName = cleanText(body.lastName, 'Last name', { max: 80 })
  const email = cleanEmail(body.email)
  const password = cleanPassword(body.password)
  if (body.acceptTerms !== true) throw new HttpError(400, 'terms_required', 'Accept the privacy notice and website terms to apply.')
  const profile = { firstName, lastName, website: cleanWebsite(body.website) }

  if (role === 'advertiser') {
    profile.companyName = cleanText(body.companyName, 'Business name', { max: 160 })
    profile.teamSize = cleanText(body.teamSize, 'Sales team size', { max: 16 })
    profile.vertical = cleanText(body.vertical, 'Primary industry', { max: 40 })
    profile.campaignNeeds = cleanText(body.campaignNeeds, 'Campaign requirements', { required: false, max: 1200 })
    if (!teamSizes.has(profile.teamSize)) throw new HttpError(400, 'invalid_team_size', 'Choose a valid sales team size.')
    if (!verticals.has(profile.vertical)) throw new HttpError(400, 'invalid_vertical', 'Choose an industry from the list.')
  } else {
    profile.accountType = cleanText(body.accountType, 'Account type', { max: 20 })
    profile.companyName = cleanText(body.companyName, 'Business name', { required: profile.accountType === 'business', max: 160 })
    profile.country = cleanText(body.country, 'Country', { max: 80 })
    profile.trafficSources = Array.isArray(body.trafficSources) ? body.trafficSources : []
    profile.monthlyLeads = cleanText(body.monthlyLeads, 'Estimated monthly leads', { max: 24 })
    profile.complianceConfirmed = body.complianceConfirmed === true
    if (!['individual', 'business'].includes(profile.accountType)) {
      throw new HttpError(400, 'invalid_account_type', 'Choose an individual or business account.')
    }
    if (!profile.trafficSources.length || profile.trafficSources.length > publisherSources.size ||
      profile.trafficSources.some((source) => typeof source !== 'string' || !publisherSources.has(source))) {
      throw new HttpError(400, 'invalid_traffic_sources', 'Choose at least one valid traffic source.')
    }
    if (!publisherVolumes.has(profile.monthlyLeads)) {
      throw new HttpError(400, 'invalid_monthly_leads', 'Choose an estimated monthly lead volume.')
    }
    if (!profile.complianceConfirmed) {
      throw new HttpError(400, 'compliance_confirmation_required', 'Confirm that your traffic and data practices meet applicable requirements.')
    }
  }

  return {
    email,
    password,
    fullName: `${firstName} ${lastName}`,
    profile,
  }
}

function safeUser(account) {
  return {
    id: account.id,
    role: account.role,
    email: account.email,
    fullName: account.full_name,
    status: account.status,
  }
}

function safeOffer(offer) {
  return {
    id: offer.id,
    title: offer.title,
    campaignType: offer.campaign_type,
    industry: offer.industry,
    vertical: offer.vertical,
    productType: offer.product_type,
    paymentTerms: offer.payment_terms,
    payoutMethod: offer.payout_method,
    payoutAmount: offer.payout_amount,
    payoutCurrency: offer.payout_currency,
    payout: offer.payout_amount,
    image: offer.image || null,
    states: JSON.parse(offer.states_json),
    schedule: offer.schedule,
    percentage: offer.percentage,
    bufferSeconds: offer.buffer_seconds,
    availableFrom: offer.available_from,
    dateAvailable: offer.available_from,
    description: offer.description,
    requirements: (() => {
      try {
        const configured = JSON.parse(offer.requirements_json || '[]')
        if (configured.length) return configured
        return [
          offer.qualification_requirements,
          offer.traffic_requirements,
          ...JSON.parse(offer.restrictions_json || '[]'),
        ].filter(Boolean)
      } catch {
        return []
      }
    })(),
    qualificationRequirements: offer.qualification_requirements,
    trafficRequirements: offer.traffic_requirements,
    restrictions: JSON.parse(offer.restrictions_json),
    isDemo: Boolean(offer.is_demo),
  }
}

function offerFacets(searchParams, key, allowed) {
  const values = searchParams.getAll(key)
  if (values.length > allowed.length || values.some((value) => !allowed.includes(value))) {
    throw new HttpError(400, 'invalid_filter', `One or more ${key} filters are not supported.`)
  }
  return [...new Set(values)]
}

function offerPage(searchParams, key, fallback) {
  const value = searchParams.get(key)
  if (value === null) return fallback
  if (!/^[1-9]\d{0,5}$/.test(value)) throw new HttpError(400, 'invalid_pagination', `The ${key} value is invalid.`)
  return Number(value)
}

function getSession(req, db, production, now) {
  const token = parseCookies(req.headers.cookie)[cookieName(production)]
  if (!token || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) return null
  const tokenHash = hashToken(token)
  const account = db.prepare(`
    SELECT a.id, a.role, a.email, a.full_name, a.status, s.expires_at
    FROM sessions s JOIN accounts a ON a.id = s.account_id
    WHERE s.token_hash = ?
  `).get(tokenHash)
  if (!account) return null
  if (account.expires_at <= now() || account.status !== 'approved') {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash)
    return null
  }
  return { tokenHash, account }
}

function safePath(root, pathname) {
  let decoded
  try {
    decoded = decodeURIComponent(pathname)
  } catch {
    return null
  }
  const target = resolve(root, `.${decoded}`)
  const relativePath = relative(root, target)
  if (relativePath === '..' || relativePath.startsWith(`..${sep}`) || isAbsolute(relativePath)) return null
  return target
}

function serveStatic(req, res, staticDirectory) {
  if (!staticDirectory || !['GET', 'HEAD'].includes(req.method || '')) return false
  const requestUrl = new URL(req.url || '/', 'http://localhost')
  const target = safePath(staticDirectory, requestUrl.pathname)
  if (!target) {
    sendJson(res, 400, { error: 'invalid_path', message: 'That address is invalid.' })
    return true
  }
  const file = existsSync(target) && statSync(target).isFile() ? target : resolve(staticDirectory, 'index.html')
  if (!existsSync(file)) {
    sendJson(res, 404, { error: 'not_found', message: 'The requested page was not found.' })
    return true
  }
  const fileSize = statSync(file).size
  const isAsset = file.includes(`${sep}assets${sep}`)
  res.writeHead(200, {
    'Content-Type': mimeTypes[extname(file)] || 'application/octet-stream',
    'Content-Length': fileSize,
    'Cache-Control': isAsset ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  if (req.method === 'HEAD') res.end()
  else createReadStream(file).pipe(res)
  return true
}

export function createRingstackServer({
  db,
  sendPasswordResetEmail,
  publicOrigin,
  production = false,
  trustProxy = false,
  staticDirectory,
  now = Date.now,
}) {
  if (!db) throw new Error('A database connection is required.')
  const rateLimit = createRateLimiter(now)
  const dummyHash = hashPassword(randomBytes(32).toString('base64url'))
  const sessionCookieName = cookieName(production)

  return createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin')
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')

    try {
      const requestUrl = new URL(req.url || '/', 'http://localhost')
      const pathname = requestUrl.pathname

      if (pathname.startsWith('/api/')) {
        if (req.method === 'POST') validateOrigin(req, publicOrigin)

        const registrationMatch = pathname.match(/^\/api\/auth\/register\/([^/]+)$/)
        if (req.method === 'POST' && registrationMatch) {
          const role = registrationMatch[1]
          if (!allowedRoles.has(role)) throw new HttpError(404, 'not_found', 'That authentication route was not found.')
          const ip = requestIp(req, trustProxy)
          rateLimit(`register:${ip}`, 5, 60 * 60 * 1000)
          const body = await readJson(req)
          const account = validateRegistration(role, body)
          const passwordHash = await hashPassword(account.password)
          const id = randomUUID()
          const timestamp = now()
          const result = db.prepare(`
            INSERT INTO accounts (
              id, role, email, full_name, password_hash, status, profile_json,
              terms_version, terms_accepted_at, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, 'pending', ?, '2026-11', ?, ?, ?)
            ON CONFLICT(role, email) DO NOTHING
          `).run(id, role, account.email, account.fullName, passwordHash, JSON.stringify(account.profile), timestamp, timestamp, timestamp)
          if (Number(result.changes) === 0) {
            throw new HttpError(409, 'application_exists', 'An application already exists for this account type and email. Contact Ringstack if you need help.')
          }
          sendJson(res, 201, {
            message: 'Your application has been received and is pending review. Ringstack will contact you about the next step.',
            user: { id, role, email: account.email, fullName: account.fullName, status: 'pending' },
          })
          return
        }

        const loginMatch = pathname.match(/^\/api\/auth\/login\/([^/]+)$/)
        if (req.method === 'POST' && loginMatch) {
          const role = loginMatch[1]
          if (!allowedRoles.has(role)) throw new HttpError(404, 'not_found', 'That authentication route was not found.')
          const body = await readJson(req)
          const email = cleanEmail(body.email)
          const password = typeof body.password === 'string' && body.password.length <= 128 ? body.password : ''
          const ip = requestIp(req, trustProxy)
          rateLimit(`login-ip:${ip}`, 30, 15 * 60 * 1000)
          rateLimit(`login:${ip}:${role}:${email}`, 10, 15 * 60 * 1000)
          const account = db.prepare('SELECT * FROM accounts WHERE role = ? AND email = ?').get(role, email)
          const passwordHash = account?.password_hash || await dummyHash
          const validPassword = await verifyPassword(password, passwordHash) && typeof body.password === 'string' && body.password.length <= 128
          if (!account || !validPassword) {
            throw new HttpError(401, 'invalid_credentials', 'The email or password is incorrect.')
          }
          if (account.status === 'pending') {
            throw new HttpError(403, 'pending_approval', 'Your application is being reviewed. You can sign in once Ringstack approves it.')
          }
          if (account.status === 'rejected') {
            throw new HttpError(403, 'application_not_approved', 'This application was not approved. Contact Ringstack if you believe this is an error.')
          }
          if (account.status === 'suspended') {
            throw new HttpError(403, 'account_suspended', 'This account is currently suspended. Contact Ringstack for assistance.')
          }

          const token = randomBytes(32).toString('base64url')
          const expiresAt = now() + (body.rememberMe === true ? rememberedSessionDuration : sessionDuration)
          db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now())
          db.prepare('INSERT INTO sessions (token_hash, account_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
            .run(hashToken(token), account.id, now(), expiresAt)
          const maxAge = body.rememberMe === true ? Math.floor(rememberedSessionDuration / 1000) : 0
          sendJson(res, 200, { user: safeUser(account) }, { 'Set-Cookie': sessionCookie(token, production, maxAge) })
          return
        }

        const resetRequestMatch = pathname.match(/^\/api\/auth\/forgot-password\/([^/]+)$/)
        if (req.method === 'POST' && resetRequestMatch) {
          const role = resetRequestMatch[1]
          if (!allowedRoles.has(role)) throw new HttpError(404, 'not_found', 'That authentication route was not found.')
          const body = await readJson(req)
          const email = cleanEmail(body.email)
          const ip = requestIp(req, trustProxy)
          rateLimit(`reset:${ip}`, 5, 60 * 60 * 1000)
          if (typeof sendPasswordResetEmail !== 'function') {
            throw new HttpError(503, 'reset_unavailable', 'Password reset is not available right now. Contact Ringstack for help.')
          }
          const account = db.prepare(`
            SELECT id, email, role FROM accounts
            WHERE role = ? AND email = ? AND status IN ('pending', 'approved')
          `).get(role, email)
          if (account) {
            const token = randomBytes(32).toString('base64url')
            const tokenHash = hashToken(token)
            const createdAt = now()
            db.prepare('DELETE FROM password_reset_tokens WHERE account_id = ?').run(account.id)
            db.prepare(`
              INSERT INTO password_reset_tokens (token_hash, account_id, created_at, expires_at)
              VALUES (?, ?, ?, ?)
            `).run(tokenHash, account.id, createdAt, createdAt + resetDuration)
            const origin = publicOrigin || req.headers.origin
            const resetUrl = new URL(`/${role}/reset-password?token=${encodeURIComponent(token)}`, origin).href
            try {
              await sendPasswordResetEmail({ to: account.email, role, resetUrl })
            } catch (error) {
              db.prepare('DELETE FROM password_reset_tokens WHERE token_hash = ?').run(tokenHash)
              console.error(`[auth] Password reset email delivery failed (${error?.code || error?.name || 'Error'}).`)
              throw new HttpError(503, 'email_delivery_failed', 'We could not send the reset email. Please try again later or contact Ringstack.')
            }
          }
          sendJson(res, 202, {
            message: 'If an account matches those details, password reset instructions will be sent to its email address.',
          })
          return
        }

        const passwordResetMatch = pathname.match(/^\/api\/auth\/reset-password\/([^/]+)$/)
        if (req.method === 'POST' && passwordResetMatch) {
          const role = passwordResetMatch[1]
          if (!allowedRoles.has(role)) throw new HttpError(404, 'not_found', 'That authentication route was not found.')
          const body = await readJson(req)
          const token = cleanText(body.token, 'Reset token', { max: 100 })
          const password = cleanPassword(body.password)
          if (!/^[A-Za-z0-9_-]{40,60}$/.test(token)) {
            throw new HttpError(400, 'invalid_reset_token', 'This reset link is invalid or has expired. Request a new one.')
          }
          const passwordHash = await hashPassword(password)
          db.exec('BEGIN IMMEDIATE')
          try {
            const reset = db.prepare(`
              SELECT t.account_id, t.expires_at, a.role
              FROM password_reset_tokens t JOIN accounts a ON a.id = t.account_id
              WHERE t.token_hash = ?
            `).get(hashToken(token))
            if (!reset || reset.role !== role || reset.expires_at <= now()) {
              db.exec('ROLLBACK')
              throw new HttpError(400, 'invalid_reset_token', 'This reset link is invalid or has expired. Request a new one.')
            }
            db.prepare('UPDATE accounts SET password_hash = ?, updated_at = ? WHERE id = ?')
              .run(passwordHash, now(), reset.account_id)
            db.prepare('DELETE FROM password_reset_tokens WHERE account_id = ?').run(reset.account_id)
            db.prepare('DELETE FROM sessions WHERE account_id = ?').run(reset.account_id)
            db.exec('COMMIT')
          } catch (error) {
            if (!(error instanceof HttpError)) db.exec('ROLLBACK')
            throw error
          }
          sendJson(res, 200, { message: 'Your password has been updated. Sign in with your new password.' })
          return
        }

        if (req.method === 'GET' && pathname === '/api/auth/session') {
          const session = getSession(req, db, production, now)
          sendJson(res, 200, { user: session ? safeUser(session.account) : null })
          return
        }

        if (req.method === 'POST' && pathname === '/api/auth/logout') {
          const token = parseCookies(req.headers.cookie)[sessionCookieName]
          if (token && /^[A-Za-z0-9_-]{40,60}$/.test(token)) {
            db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token))
          }
          sendJson(res, 200, { message: 'You have been signed out.' }, { 'Set-Cookie': expiredCookie(production) })
          return
        }

        if (req.method === 'GET' && pathname === '/api/offers/options') {
          sendJson(res, 200, {
            campaignTypes,
            industries: offerIndustries,
            verticals: offerVerticals,
            productTypes,
          })
          return
        }

        if (req.method === 'GET' && pathname === '/api/offers') {
          const filters = [
            ['campaignType', 'campaign_type', campaignTypes],
            ['industry', 'industry', offerIndustries],
            ['vertical', 'vertical', offerVerticals],
            ['productType', 'product_type', productTypes],
          ]
          const where = ["status = 'active'"]
          const parameters = []
          if (production) where.push('is_demo = 0')
          for (const [key, column, options] of filters) {
            const values = offerFacets(requestUrl.searchParams, key, options)
            if (values.length) {
              where.push(`${column} IN (${values.map(() => '?').join(', ')})`)
              parameters.push(...values)
            }
          }
          const whereSql = `WHERE ${where.join(' AND ')}`
          const total = Number(db.prepare(`SELECT COUNT(*) AS count FROM offers ${whereSql}`).get(...parameters).count)
          const requestedPage = offerPage(requestUrl.searchParams, 'page', 1)
          const pageSize = offerPage(requestUrl.searchParams, 'pageSize', 12)
          if (pageSize > 48) throw new HttpError(400, 'invalid_pagination', 'The pageSize value cannot exceed 48.')
          const totalPages = Math.max(1, Math.ceil(total / pageSize))
          const page = Math.min(requestedPage, totalPages)
          const offers = db.prepare(`
            SELECT * FROM offers ${whereSql}
            ORDER BY updated_at DESC, title COLLATE NOCASE ASC
            LIMIT ? OFFSET ?
          `).all(...parameters, pageSize, (page - 1) * pageSize)
          sendJson(res, 200, {
            offers: offers.map(safeOffer),
            pagination: { page, pageSize, total, totalPages },
          })
          return
        }

        const applicationMatch = pathname.match(/^\/api\/offers\/([a-z0-9_-]{2,64})\/applications$/)
        if (req.method === 'POST' && applicationMatch) {
          const session = getSession(req, db, production, now)
          if (!session) throw new HttpError(401, 'unauthenticated', 'Sign in as an approved publisher to apply.')
          if (session.account.role !== 'publisher') {
            throw new HttpError(403, 'role_forbidden', 'Only approved publishers can apply to offers.')
          }
          const offer = db.prepare(`
            SELECT id, is_demo FROM offers WHERE id = ? AND status = 'active'
          `).get(applicationMatch[1])
          if (!offer || (production && offer.is_demo)) {
            throw new HttpError(404, 'offer_not_found', 'That offer is not currently available.')
          }
          if (offer.is_demo) {
            throw new HttpError(409, 'demo_offer', 'Development demo offers cannot receive applications.')
          }
          const existing = db.prepare(`
            SELECT status FROM offer_applications WHERE offer_id = ? AND publisher_id = ?
          `).get(offer.id, session.account.id)
          if (existing) {
            sendJson(res, 200, { status: existing.status, alreadyApplied: true })
            return
          }
          rateLimit(`offer-application:${session.account.id}`, 20, 60 * 60 * 1000)
          const body = await readJson(req)
          const message = cleanText(body.message, 'Application note', { required: false, max: 1200 })
          const id = randomUUID()
          const timestamp = now()
          db.prepare(`
            INSERT INTO offer_applications (
              id, offer_id, publisher_id, status, message, created_at, updated_at
            ) VALUES (?, ?, ?, 'pending', ?, ?, ?)
            ON CONFLICT(offer_id, publisher_id) DO NOTHING
          `).run(id, offer.id, session.account.id, message, timestamp, timestamp)
          const application = db.prepare(`
            SELECT status FROM offer_applications WHERE offer_id = ? AND publisher_id = ?
          `).get(offer.id, session.account.id)
          sendJson(res, 201, { status: application.status, alreadyApplied: false })
          return
        }

        const offerMatch = pathname.match(/^\/api\/offers\/([a-z0-9_-]{2,64})$/)
        if (req.method === 'GET' && offerMatch) {
          const offer = db.prepare(`
            SELECT * FROM offers
            WHERE id = ? AND status = 'active' AND (? = 0 OR is_demo = 0)
          `).get(offerMatch[1], production ? 1 : 0)
          if (!offer) throw new HttpError(404, 'offer_not_found', 'That offer is not currently available.')
          const session = getSession(req, db, production, now)
          const application = session?.account.role === 'publisher'
            ? db.prepare('SELECT status FROM offer_applications WHERE offer_id = ? AND publisher_id = ?')
              .get(offer.id, session.account.id)
            : null
          sendJson(res, 200, { offer: safeOffer(offer), applicationStatus: application?.status || null })
          return
        }

        const portalMatch = pathname.match(/^\/api\/portal\/([^/]+)$/)
        if (req.method === 'GET' && portalMatch) {
          const role = portalMatch[1]
          if (!allowedRoles.has(role)) throw new HttpError(404, 'not_found', 'That portal was not found.')
          const session = getSession(req, db, production, now)
          if (!session) throw new HttpError(401, 'unauthenticated', 'Sign in to continue.')
          if (session.account.role !== role) {
            throw new HttpError(403, 'role_forbidden', 'This account is not permitted to access that portal.')
          }
          if (role === 'publisher') {
            const demoClause = production ? 'AND o.is_demo = 0' : ''
            const activeOffers = Number(db.prepare(`
              SELECT COUNT(*) AS count FROM offers o
              WHERE o.status = 'active' ${demoClause}
            `).get().count)
            const applications = db.prepare(`
              SELECT a.offer_id AS offerId, a.status, a.created_at AS appliedAt,
                o.title AS offerTitle, o.status AS offerStatus, o.is_demo AS isDemo
              FROM offer_applications a
              JOIN offers o ON o.id = a.offer_id
              WHERE a.publisher_id = ?
              ORDER BY a.created_at DESC
              LIMIT 100
            `).all(session.account.id).map((application) => ({
              ...application,
              isDemo: Boolean(application.isDemo),
            }))
            sendJson(res, 200, {
              user: safeUser(session.account),
              activeOffers,
              applications,
              developmentDemoInventory: !production,
            })
            return
          }
          sendJson(res, 200, { user: safeUser(session.account) })
          return
        }

        sendJson(res, 404, { error: 'not_found', message: 'That API route was not found.' })
        return
      }

      if (serveStatic(req, res, staticDirectory)) return
      sendJson(res, 404, { error: 'not_found', message: 'That page was not found.' })
    } catch (error) {
      sendError(res, error)
    }
  })
}
