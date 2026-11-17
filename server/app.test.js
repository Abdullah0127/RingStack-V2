import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, test } from 'node:test'
import { createRingstackServer } from './app.js'
import { openDatabase } from './db.js'
import { seedDevelopmentOffers } from './dev-offers.js'

const db = openDatabase(':memory:')
const sentEmails = []
let testNow = Date.now()
const testDirectory = mkdtempSync(join(tmpdir(), 'ringstack-auth-test-'))
const staticDirectory = join(testDirectory, 'dist')
mkdirSync(staticDirectory)
writeFileSync(join(staticDirectory, 'index.html'), '<main>Ringstack</main>')
writeFileSync(join(testDirectory, 'secret.txt'), 'private')
const server = createRingstackServer({
  db,
  sendPasswordResetEmail: async (email) => sentEmails.push(email),
  trustProxy: true,
  now: () => testNow,
  staticDirectory,
})

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${server.address().port}`

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  db.close()
  rmSync(testDirectory, { recursive: true, force: true })
})

async function request(path, { method = 'GET', body, cookie, ip } = {}) {
  const headers = { Origin: origin }
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  if (cookie) headers.Cookie = cookie
  if (ip) headers['X-Forwarded-For'] = ip
  const response = await fetch(`${origin}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  return { response, body: await response.json() }
}

function advertiserApplication(email, password = 'secure advertiser password') {
  return {
    firstName: 'Avery',
    lastName: 'Partner',
    email,
    password,
    companyName: 'Example Advertiser',
    teamSize: '2-5',
    vertical: 'insurance',
    acceptTerms: true,
  }
}

test('separate applications, approval, role checks, reset tokens, and session revocation', async () => {
  const traversal = await request('/.%2F..%2Fsecret.txt')
  assert.equal(traversal.response.status, 400)

  const application = await request('/api/auth/register/advertiser', {
    method: 'POST',
    body: advertiserApplication('advertiser@example.test'),
  })
  assert.equal(application.response.status, 201)
  assert.equal(application.body.user.status, 'pending')

  const pendingLogin = await request('/api/auth/login/advertiser', {
    method: 'POST',
    body: { email: 'advertiser@example.test', password: 'secure advertiser password' },
  })
  assert.equal(pendingLogin.response.status, 403)
  assert.equal(pendingLogin.body.error, 'pending_approval')

  const wrongRoleLogin = await request('/api/auth/login/publisher', {
    method: 'POST',
    body: { email: 'advertiser@example.test', password: 'secure advertiser password' },
  })
  assert.equal(wrongRoleLogin.response.status, 401)

  db.prepare("UPDATE accounts SET status = 'approved' WHERE role = 'advertiser' AND email = ?")
    .run('advertiser@example.test')
  const login = await request('/api/auth/login/advertiser', {
    method: 'POST',
    body: { email: 'advertiser@example.test', password: 'secure advertiser password', rememberMe: true },
  })
  assert.equal(login.response.status, 200)
  const cookie = login.response.headers.get('set-cookie')
  assert.match(cookie, /HttpOnly/)
  assert.match(cookie, /SameSite=Lax/)
  assert.match(cookie, /Max-Age=2592000/)

  const advertiserPortal = await request('/api/portal/advertiser', { cookie })
  assert.equal(advertiserPortal.response.status, 200)
  const publisherPortal = await request('/api/portal/publisher', { cookie })
  assert.equal(publisherPortal.response.status, 403)
  assert.equal(publisherPortal.body.error, 'role_forbidden')

  const resetRequest = await request('/api/auth/forgot-password/advertiser', {
    method: 'POST',
    body: { email: 'advertiser@example.test' },
  })
  assert.equal(resetRequest.response.status, 202)
  assert.equal(sentEmails.length, 1)
  const resetUrl = new URL(sentEmails[0].resetUrl)
  const token = resetUrl.searchParams.get('token')
  assert.ok(token)

  const reset = await request('/api/auth/reset-password/advertiser', {
    method: 'POST',
    body: { token, password: 'updated advertiser password' },
  })
  assert.equal(reset.response.status, 200)
  const staleSession = await request('/api/auth/session', { cookie })
  assert.equal(staleSession.response.status, 200)
  assert.equal(staleSession.body.user, null)

  const replay = await request('/api/auth/reset-password/advertiser', {
    method: 'POST',
    body: { token, password: 'another updated password' },
  })
  assert.equal(replay.response.status, 400)
  const updatedLogin = await request('/api/auth/login/advertiser', {
    method: 'POST',
    body: { email: 'advertiser@example.test', password: 'updated advertiser password' },
  })
  assert.equal(updatedLogin.response.status, 200)
  const logout = await request('/api/auth/logout', { method: 'POST', body: {}, cookie: updatedLogin.response.headers.get('set-cookie') })
  assert.equal(logout.response.status, 200)
  const loggedOutSession = await request('/api/auth/session', { cookie: updatedLogin.response.headers.get('set-cookie') })
  assert.equal(loggedOutSession.response.status, 200)
  assert.equal(loggedOutSession.body.user, null)
  db.prepare("UPDATE accounts SET status = 'suspended' WHERE role = 'advertiser' AND email = ?")
    .run('advertiser@example.test')
  const suspendedLogin = await request('/api/auth/login/advertiser', {
    method: 'POST',
    body: { email: 'advertiser@example.test', password: 'updated advertiser password' },
  })
  assert.equal(suspendedLogin.response.status, 403)
  assert.equal(suspendedLogin.body.error, 'account_suspended')

  const publisherApplication = await request('/api/auth/register/publisher', {
    method: 'POST',
    body: {
      firstName: 'Parker',
      lastName: 'Creator',
      email: 'publisher@example.test',
      password: 'secure publisher password',
      accountType: 'individual',
      country: 'United Kingdom',
      trafficSources: ['owned-website'],
      monthlyLeads: 'not-sure',
      complianceConfirmed: true,
      acceptTerms: true,
    },
  })
  assert.equal(publisherApplication.response.status, 201)
  assert.equal(publisherApplication.body.user.role, 'publisher')
  assert.equal(publisherApplication.body.user.status, 'pending')

  const expiringResetRequest = await request('/api/auth/forgot-password/publisher', {
    method: 'POST',
    body: { email: 'publisher@example.test' },
  })
  assert.equal(expiringResetRequest.response.status, 202)
  assert.equal(sentEmails.length, 2)
  const expiringToken = new URL(sentEmails[1].resetUrl).searchParams.get('token')
  testNow += 60 * 60 * 1000 + 1
  const expiredReset = await request('/api/auth/reset-password/publisher', {
    method: 'POST',
    body: { token: expiringToken, password: 'expired reset password' },
  })
  assert.equal(expiredReset.response.status, 400)
  assert.equal(expiredReset.body.error, 'invalid_reset_token')

  let limited
  for (let attempt = 0; attempt < 11; attempt += 1) {
    limited = await request('/api/auth/login/advertiser', {
      method: 'POST',
      body: { email: 'rate-limit@example.test', password: 'not the right password' },
      ip: '198.51.100.42',
    })
  }
  assert.equal(limited.response.status, 429)
  assert.ok(Number(limited.response.headers.get('retry-after')) > 0)
})

test('marketplace filters combine groups with AND, values within groups with OR, and paginate active offers', async () => {
  seedDevelopmentOffers(db, () => testNow)
  const inbound = await request('/api/offers?productType=Inbound%20Call&page=1&pageSize=48')
  assert.equal(inbound.response.status, 200)
  assert.match(inbound.response.headers.get('content-type'), /^application\/json\b/i)
  assert.equal(inbound.body.pagination.total, 4)
  assert.ok(inbound.body.offers.every((offer) => offer.productType === 'Inbound Call' && offer.isDemo))

  const filtered = await request('/api/offers?campaignType=CPA&campaignType=CPL&industry=Insurance&industry=Travel&productType=Inbound%20Call')
  assert.equal(filtered.response.status, 200)
  assert.deepEqual(filtered.body.offers.map((offer) => offer.id).sort(), [
    'demo-auto-insurance-call',
    'demo-health-cover-call',
  ])
  assert.ok(filtered.body.offers.every((offer) => offer.isDemo))

  const paged = await request('/api/offers?page=2&pageSize=2')
  assert.equal(paged.response.status, 200)
  assert.equal(paged.body.pagination.total, 12)
  assert.equal(paged.body.pagination.page, 2)
  assert.equal(paged.body.offers.length, 2)

  db.prepare("UPDATE offers SET status = 'paused' WHERE id = ?").run('demo-business-tax-credit-lead')
  const activeOnly = await request('/api/offers')
  assert.equal(activeOnly.body.pagination.total, 11)
  assert.ok(activeOnly.body.offers.every((offer) => offer.id !== 'demo-business-tax-credit-lead'))
  const pausedDetail = await request('/api/offers/demo-business-tax-credit-lead')
  assert.equal(pausedDetail.response.status, 404)
  db.prepare("UPDATE offers SET status = 'active' WHERE id = ?").run('demo-business-tax-credit-lead')

  const invalidFilter = await request('/api/offers?industry=unknown')
  assert.equal(invalidFilter.response.status, 400)
  const invalidPage = await request('/api/offers?page=0')
  assert.equal(invalidPage.response.status, 400)
})

test('only approved publishers apply, applications are idempotent, and publisher dashboard shows status', async () => {
  const demoOffer = await request('/api/offers/demo-health-cover-call')
  assert.equal(demoOffer.response.status, 200)
  assert.equal(demoOffer.body.offer.isDemo, true)
  const demoApplication = await request('/api/offers/demo-health-cover-call/applications', {
    method: 'POST',
    body: {},
  })
  assert.equal(demoApplication.response.status, 401)

  const pendingLogin = await request('/api/auth/login/publisher', {
    method: 'POST',
    body: { email: 'publisher@example.test', password: 'secure publisher password' },
  })
  assert.equal(pendingLogin.response.status, 403)
  assert.equal(pendingLogin.body.error, 'pending_approval')
  db.prepare("UPDATE accounts SET status = 'approved' WHERE role = 'publisher' AND email = ?")
    .run('publisher@example.test')
  const publisherLogin = await request('/api/auth/login/publisher', {
    method: 'POST',
    body: { email: 'publisher@example.test', password: 'secure publisher password' },
  })
  assert.equal(publisherLogin.response.status, 200)
  const publisherCookie = publisherLogin.response.headers.get('set-cookie')

  const demoApplicationByPublisher = await request('/api/offers/demo-health-cover-call/applications', {
    method: 'POST',
    body: {},
    cookie: publisherCookie,
  })
  assert.equal(demoApplicationByPublisher.response.status, 409)
  assert.equal(demoApplicationByPublisher.body.error, 'demo_offer')

  db.prepare(`
    UPDATE offers
    SET title = 'Test-only configured campaign', is_demo = 0, updated_at = ?
    WHERE id = 'demo-health-cover-call'
  `).run(testNow)
  const application = await request('/api/offers/demo-health-cover-call/applications', {
    method: 'POST',
    body: { message: 'A test publisher application.' },
    cookie: publisherCookie,
  })
  assert.equal(application.response.status, 201)
  assert.equal(application.body.status, 'pending')

  const duplicate = await request('/api/offers/demo-health-cover-call/applications', {
    method: 'POST',
    body: {},
    cookie: publisherCookie,
  })
  assert.equal(duplicate.response.status, 200)
  assert.equal(duplicate.body.status, 'pending')
  assert.equal(duplicate.body.alreadyApplied, true)

  const detail = await request('/api/offers/demo-health-cover-call')
  assert.equal(detail.response.status, 200)
  const publisherDetail = await request('/api/offers/demo-health-cover-call', { cookie: publisherCookie })
  assert.equal(publisherDetail.body.applicationStatus, 'pending')
  const publisherPortal = await request('/api/portal/publisher', { cookie: publisherCookie })
  assert.equal(publisherPortal.response.status, 200)
  assert.equal(publisherPortal.body.applications.length, 1)
  assert.equal(publisherPortal.body.applications[0].status, 'pending')

  const advertiserRegistration = await request('/api/auth/register/advertiser', {
    method: 'POST',
    body: advertiserApplication('advertiser-offers@example.test'),
  })
  assert.equal(advertiserRegistration.response.status, 201)
  db.prepare("UPDATE accounts SET status = 'approved' WHERE role = 'advertiser' AND email = ?")
    .run('advertiser-offers@example.test')
  const advertiserLogin = await request('/api/auth/login/advertiser', {
    method: 'POST',
    body: { email: 'advertiser-offers@example.test', password: 'secure advertiser password' },
  })
  const advertiserApplicationAttempt = await request('/api/offers/demo-health-cover-call/applications', {
    method: 'POST',
    body: {},
    cookie: advertiserLogin.response.headers.get('set-cookie'),
  })
  assert.equal(advertiserApplicationAttempt.response.status, 403)
  assert.equal(advertiserApplicationAttempt.body.error, 'role_forbidden')
})

test('production marketplace hides demo inventory but serves configured offers', async () => {
  const productionDb = openDatabase(':memory:')
  seedDevelopmentOffers(productionDb, () => testNow)
  productionDb.prepare(`
    UPDATE offers SET title = 'Test-only production campaign', is_demo = 0
    WHERE id = 'demo-health-cover-call'
  `).run()
  const productionServer = createRingstackServer({ db: productionDb, production: true })
  await new Promise((resolve) => productionServer.listen(0, '127.0.0.1', resolve))
  const productionOrigin = `http://127.0.0.1:${productionServer.address().port}`
  try {
    const listingResponse = await fetch(`${productionOrigin}/api/offers`, { headers: { Origin: productionOrigin } })
    const listing = await listingResponse.json()
    assert.equal(listingResponse.status, 200)
    assert.equal(listing.pagination.total, 1)
    assert.equal(listing.offers[0].id, 'demo-health-cover-call')
    assert.equal(listing.offers[0].isDemo, false)

    const hiddenResponse = await fetch(`${productionOrigin}/api/offers/demo-personal-injury-transfer`)
    const hidden = await hiddenResponse.json()
    assert.equal(hiddenResponse.status, 404)
    assert.equal(hidden.error, 'offer_not_found')
  } finally {
    await new Promise((resolve, reject) => productionServer.close((error) => error ? reject(error) : resolve()))
    productionDb.close()
  }
})
