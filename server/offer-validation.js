import { campaignTypes, offerIndustries, offerVerticals, productTypes } from '../shared/offerFacets.js'

const offerIdPattern = /^[a-z0-9][a-z0-9_-]{1,63}$/
const datePattern = /^\d{4}-\d{2}-\d{2}$/

function requiredText(value, field, max) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new Error(`${field} must be a non-empty string of at most ${max} characters.`)
  }
  return value.trim()
}

function optionalText(value, field, max) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'string' || value.trim().length > max) {
    throw new Error(`${field} must be a string of at most ${max} characters.`)
  }
  return value.trim() || null
}

function enumValue(value, field, allowed) {
  if (!allowed.includes(value)) throw new Error(`${field} must be one of the configured marketplace options.`)
  return value
}

function optionalNumber(value, field, { min, max, integer = false } = {}) {
  if (value === undefined || value === null || value === '') return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value))) {
    throw new Error(`${field} must be a number between ${min} and ${max}${integer ? ' with no decimals' : ''}.`)
  }
  return value
}

export function normalizeOffer(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Each offer must be a JSON object.')
  const id = requiredText(value.id, 'Offer ID', 64)
  if (!offerIdPattern.test(id)) throw new Error('Offer ID may contain lowercase letters, numbers, underscores, and hyphens.')

  const states = value.states === undefined ? [] : value.states
  if (!Array.isArray(states) || states.length > 60 || states.some((state) => typeof state !== 'string' || !/^[A-Za-z0-9 -]{1,32}$/.test(state.trim()))) {
    throw new Error('States must be a list of at most 60 short labels.')
  }
  const restrictions = value.restrictions === undefined ? [] : value.restrictions
  if (!Array.isArray(restrictions) || restrictions.length > 30) throw new Error('Restrictions must be a list of at most 30 items.')

  const availableFrom = optionalText(value.availableFrom, 'Available date', 10)
  if (availableFrom) {
    const date = new Date(`${availableFrom}T00:00:00.000Z`)
    if (!datePattern.test(availableFrom) || Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== availableFrom) {
      throw new Error('Available date must be a valid date in YYYY-MM-DD format.')
    }
  }
  const payoutCurrency = value.payoutCurrency === undefined ? 'USD' : requiredText(value.payoutCurrency, 'Payout currency', 3)
  if (!/^[A-Z]{3}$/.test(payoutCurrency)) throw new Error('Payout currency must be a three-letter uppercase currency code.')

  const status = value.status === undefined ? 'active' : value.status
  if (!['active', 'paused'].includes(status)) throw new Error('Status must be active or paused.')

  return {
    id,
    title: requiredText(value.title, 'Title', 120),
    campaignType: enumValue(value.campaignType, 'Campaign type', campaignTypes),
    industry: enumValue(value.industry, 'Industry', offerIndustries),
    vertical: enumValue(value.vertical, 'Vertical', offerVerticals),
    productType: enumValue(value.productType, 'Product type', productTypes),
    paymentTerms: optionalText(value.paymentTerms, 'Payment terms', 120),
    payoutMethod: optionalText(value.payoutMethod, 'Payout method', 120),
    payoutAmount: optionalNumber(value.payoutAmount, 'Payout amount', { min: 0, max: 1_000_000 }),
    payoutCurrency,
    states: [...new Set(states.map((state) => state.trim().toUpperCase()))],
    schedule: optionalText(value.schedule, 'Schedule', 240),
    percentage: optionalNumber(value.percentage, 'Percentage', { min: 0, max: 100 }),
    bufferSeconds: optionalNumber(value.bufferSeconds, 'Buffer seconds', { min: 0, max: 86_400, integer: true }),
    availableFrom,
    description: optionalText(value.description, 'Description', 3000),
    qualificationRequirements: optionalText(value.qualificationRequirements, 'Qualification requirements', 2000),
    trafficRequirements: optionalText(value.trafficRequirements, 'Traffic requirements', 2000),
    restrictions: restrictions.map((restriction) => requiredText(restriction, 'Restriction', 300)),
    status,
  }
}
