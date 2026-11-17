import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { openDatabase } from './db.js'
import { normalizeOffer } from './offer-validation.js'

const sourcePath = process.argv[2]
if (!sourcePath) {
  console.error('Usage: npm run offers:import -- <offers.json>')
  process.exitCode = 1
} else {
  const db = openDatabase()
  try {
    const parsed = JSON.parse(readFileSync(resolve(sourcePath), 'utf8'))
    const inputs = Array.isArray(parsed) ? parsed : parsed.offers
    if (!Array.isArray(inputs) || inputs.length === 0) throw new Error('Provide a JSON array with at least one configured offer.')
    const offers = inputs.map(normalizeOffer)
    if (new Set(offers.map((offer) => offer.id)).size !== offers.length) {
      throw new Error('Offer IDs must be unique within an import file.')
    }

    const actor = process.env.USERNAME || process.env.USER || 'operator'
    const timestamp = Date.now()
    const upsert = db.prepare(`
      INSERT INTO offers (
        id, title, campaign_type, industry, vertical, product_type, payment_terms,
        payout_method, payout_amount, payout_currency, states_json, schedule,
        percentage, buffer_seconds, available_from, description,
        qualification_requirements, traffic_requirements, restrictions_json,
        status, is_demo, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        campaign_type = excluded.campaign_type,
        industry = excluded.industry,
        vertical = excluded.vertical,
        product_type = excluded.product_type,
        payment_terms = excluded.payment_terms,
        payout_method = excluded.payout_method,
        payout_amount = excluded.payout_amount,
        payout_currency = excluded.payout_currency,
        states_json = excluded.states_json,
        schedule = excluded.schedule,
        percentage = excluded.percentage,
        buffer_seconds = excluded.buffer_seconds,
        available_from = excluded.available_from,
        description = excluded.description,
        qualification_requirements = excluded.qualification_requirements,
        traffic_requirements = excluded.traffic_requirements,
        restrictions_json = excluded.restrictions_json,
        status = excluded.status,
        is_demo = 0,
        updated_at = excluded.updated_at
    `)
    const lookup = db.prepare('SELECT status FROM offers WHERE id = ?')
    const audit = db.prepare(`
      INSERT INTO offer_audit_log (id, offer_id, action, previous_status, next_status, actor, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    db.exec('BEGIN IMMEDIATE')
    try {
      for (const offer of offers) {
        const prior = lookup.get(offer.id)
        upsert.run(
          offer.id,
          offer.title,
          offer.campaignType,
          offer.industry,
          offer.vertical,
          offer.productType,
          offer.paymentTerms,
          offer.payoutMethod,
          offer.payoutAmount,
          offer.payoutCurrency,
          JSON.stringify(offer.states),
          offer.schedule,
          offer.percentage,
          offer.bufferSeconds,
          offer.availableFrom,
          offer.description,
          offer.qualificationRequirements,
          offer.trafficRequirements,
          JSON.stringify(offer.restrictions),
          offer.status,
          timestamp,
          timestamp,
        )
        audit.run(
          randomUUID(),
          offer.id,
          prior ? 'updated' : 'created',
          prior?.status || null,
          offer.status,
          actor,
          timestamp,
        )
      }
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
    console.log(`Imported ${offers.length} offer record${offers.length === 1 ? '' : 's'}.`)
  } catch (error) {
    console.error(`Offer import failed: ${error.message}`)
    process.exitCode = 1
  } finally {
    db.close()
  }
}
