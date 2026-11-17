import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { campaignTypes, offerIndustries, offerVerticals, productTypes } from '../../shared/offerFacets.js'
import { useAuth } from '../auth/useAuth.js'
import { apiRequest } from '../auth/api.js'

const pageSize = 9

function formatPayout(offer) {
  if (offer.payoutAmount !== null && offer.payoutAmount !== undefined) {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: offer.payoutCurrency,
        maximumFractionDigits: 2,
      }).format(offer.payoutAmount)
    } catch {
      return `${offer.payoutCurrency || ''} ${Number(offer.payoutAmount).toFixed(2)}`.trim()
    }
  }
  return offer.percentage !== null && offer.percentage !== undefined ? `${offer.percentage}%` : null
}

function getLoadErrorMessage(requestError) {
  if (requestError.code === 'network_error') return 'Check your internet connection.'
  if (requestError.status === 401) return 'Please log in if authentication is required.'
  if (requestError.status === 404) return 'This offer is no longer available.'
  return 'Unable to load offers. Please try again.'
}

function OfferFilters({ filters, onChange, onApply, onClear }) {
  function toggle(key, value) {
    const selected = filters[key]
    onChange({
      ...filters,
      [key]: selected.includes(value)
        ? selected.filter((item) => item !== value)
        : [...selected, value],
    })
  }

  function group(label, key, values) {
    return (
      <fieldset className="offers-filter-group" key={key}>
        <legend>{label}</legend>
        {values.map((value) => (
          <label className="offers-filter-option" key={value}>
            <input
              type="checkbox"
              checked={filters[key].includes(value)}
              onChange={() => toggle(key, value)}
            />
            <span>{value}</span>
          </label>
        ))}
      </fieldset>
    )
  }

  return (
    <aside className="offers-filter-panel" aria-label="Filter offers">
      <div className="offers-filter-heading">
        <div>
          <p className="section-kicker">Refine your search</p>
          <h2>Campaign filters</h2>
        </div>
        <button className="offers-clear" type="button" onClick={onClear}>Clear all</button>
      </div>
      {group('Campaign type', 'campaignType', campaignTypes)}
      {group('Product type', 'productType', productTypes)}
      {group('Industry', 'industry', offerIndustries)}
      <details className="offers-filter-details">
        <summary>Vertical <span className="offers-option-count">{filters.vertical.length || 'All'}</span></summary>
        <div className="offers-vertical-options">
          {offerVerticals.map((value) => (
            <label className="offers-filter-option" key={value}>
              <input
                type="checkbox"
                checked={filters.vertical.includes(value)}
                onChange={() => toggle('vertical', value)}
              />
              <span>{value}</span>
            </label>
          ))}
        </div>
      </details>
      <button className="button button-primary offers-apply-filters" type="button" onClick={onApply}>Apply filters</button>
    </aside>
  )
}

function isOfferListResponse(data) {
  const pagination = data?.pagination
  return Boolean(
    data &&
    Array.isArray(data.offers) &&
    pagination &&
    Number.isInteger(pagination.page) &&
    Number.isInteger(pagination.pageSize) &&
    Number.isInteger(pagination.total) &&
    Number.isInteger(pagination.totalPages),
  )
}

function OfferCard({ offer }) {
  const facts = [
    ['Campaign type', offer.campaignType],
    ['Payment terms', offer.paymentTerms],
    ['Payout method', offer.payoutMethod],
    ['Payout', formatPayout(offer)],
    ['States', Array.isArray(offer.states) && offer.states.length ? offer.states.join(', ') : null],
    ['Schedule', offer.schedule],
    ['Percentage', offer.percentage !== null && offer.percentage !== undefined ? `${offer.percentage}%` : null],
    ['Buffer', offer.bufferSeconds !== null && offer.bufferSeconds !== undefined ? `${offer.bufferSeconds} seconds` : null],
    ['Date available', offer.dateAvailable || offer.availableFrom],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '')
  const category = [offer.industry, offer.vertical].filter(Boolean).join(' / ')

  return (
    <article className="offer-card">
      <div className="offer-card-topline">
        {offer.productType && <span>{offer.productType}</span>}
        {offer.isDemo && <span className="offer-demo-badge">Development demo</span>}
      </div>
      <h2><Link to={`/offers/${encodeURIComponent(offer.id)}`}>{offer.title}</Link></h2>
      {category && <p className="offer-card-category">{category}</p>}
      <dl className="offer-card-facts">
        {facts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
      </dl>
      <Link className="offer-card-link" to={`/offers/${encodeURIComponent(offer.id)}`}>
        View offer <span aria-hidden="true">→</span>
      </Link>
    </article>
  )
}

function OffersListing() {
  const emptyFilters = { campaignType: [], productType: [], industry: [], vertical: [] }
  const [draftFilters, setDraftFilters] = useState(emptyFilters)
  const [filters, setFilters] = useState(emptyFilters)
  const [page, setPage] = useState(1)
  const [response, setResponse] = useState({ query: '', data: null, error: '' })
  const mobileFiltersRef = useRef(null)
  const query = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    for (const [key, values] of Object.entries(filters)) {
      for (const value of values) params.append(key, value)
    }
    return params.toString()
  }, [filters, page])

  useEffect(() => {
    let active = true
    apiRequest(`/api/offers?${query}`)
      .then((data) => {
        if (!isOfferListResponse(data)) {
          console.error('[offers] API returned an unexpected listing response shape')
          if (active) setResponse({ query, data: null, error: 'Unable to load offers. Please try again.' })
          return
        }
        if (active) setResponse({ query, data, error: '' })
      })
      .catch((requestError) => { if (active) setResponse({ query, data: null, error: getLoadErrorMessage(requestError) }) })
    return () => { active = false }
  }, [query])
  const loading = response.query !== query
  const result = loading ? null : response.data
  const error = loading ? '' : response.error

  function updateFilters(next) {
    setDraftFilters(next)
  }
  function applyFilters() {
    setPage(1)
    setFilters(draftFilters)
    if (mobileFiltersRef.current) mobileFiltersRef.current.open = false
  }
  function clearFilters() {
    const cleared = { campaignType: [], productType: [], industry: [], vertical: [] }
    setPage(1)
    setDraftFilters(cleared)
    setFilters(cleared)
  }
  const selectedFilterCount = Object.values(draftFilters).reduce((count, values) => count + values.length, 0)
  return (
    <div className="offers-page">
      <section className="offers-hero">
        <div className="container offers-hero-inner">
          <p className="section-kicker">Ringstack marketplace</p>
          <h1>Find campaigns that fit your business.</h1>
          <p>Review configured campaign requirements, coverage and payment terms before you apply.</p>
          <a className="button button-primary" href="#offer-results">Explore available offers</a>
        </div>
      </section>
      <section className="container offers-marketplace" id="offer-results">
        <div className="offers-intro">
          <div>
            <p className="section-kicker">Campaign inventory</p>
            <h2>Offers marketplace</h2>
          </div>
          <p>Campaign details and availability are set by Ringstack. Review the full requirements on each offer before applying.</p>
        </div>
        <div className="offers-browser">
          <div className="offers-desktop-filters">
            <OfferFilters filters={draftFilters} onChange={updateFilters} onApply={applyFilters} onClear={clearFilters} />
          </div>
          <details className="offers-mobile-filters" ref={mobileFiltersRef}>
            <summary>Filter campaigns <span>{selectedFilterCount ? `${selectedFilterCount} selected` : 'All offers'}</span></summary>
            <OfferFilters filters={draftFilters} onChange={updateFilters} onApply={applyFilters} onClear={clearFilters} />
          </details>
          <div className="offers-results">
            {result?.offers.some((offer) => offer.isDemo) && (
              <p className="offers-demo-notice" role="note">
                Development preview: listings marked “Development demo” are examples only, are not live Ringstack inventory, and cannot receive applications.
              </p>
            )}
            {result && <p className="offers-result-count">{result.pagination.total} {result.pagination.total === 1 ? 'offer' : 'offers'} available</p>}
            {loading && <p className="offers-status" role="status">Loading offers...</p>}
            {!loading && error && <p className="offers-error" role="alert">{error}</p>}
            {!loading && !error && result?.offers.length === 0 && (
              <div className="offers-empty">
                <p className="section-kicker">No matching campaigns</p>
                <h3>No offers match your filters.</h3>
                <p>Remove one or more filters to see other configured offers.</p>
                <button className="button button-secondary" type="button" onClick={clearFilters}>Clear filters</button>
              </div>
            )}
            {!loading && !error && result?.offers.length > 0 && (
              <>
                <div className="offers-grid">{result.offers.map((offer) => <OfferCard key={offer.id} offer={offer} />)}</div>
                {result.pagination.totalPages > 1 && (
                  <nav className="offers-pagination" aria-label="Offer pages">
                    <button className="button button-secondary" type="button" disabled={result.pagination.page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
                    <span>Page {result.pagination.page} of {result.pagination.totalPages}</span>
                    <button className="button button-secondary" type="button" disabled={result.pagination.page >= result.pagination.totalPages} onClick={() => setPage((value) => value + 1)}>Next</button>
                  </nav>
                )}
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function OfferDetail() {
  const { offerId } = useParams()
  const { user } = useAuth()
  const [detail, setDetail] = useState({ id: '', offer: null, applicationStatus: null, error: '' })
  const [applyError, setApplyError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let active = true
    apiRequest(`/api/offers/${encodeURIComponent(offerId)}`)
      .then((data) => {
        if (!active) return
        if (!data || typeof data.offer !== 'object' || data.offer === null) {
          console.error('[offers] API returned an unexpected offer detail response shape')
          throw new Error('invalid_offer_response')
        }
        setDetail({ id: offerId, offer: data.offer, applicationStatus: data.applicationStatus, error: '' })
      })
      .catch((requestError) => {
        if (active) setDetail({ id: offerId, offer: null, applicationStatus: null, error: getLoadErrorMessage(requestError) })
      })
    return () => { active = false }
  }, [offerId])
  const loading = detail.id !== offerId
  const offer = loading ? null : detail.offer
  const applicationStatus = loading ? null : detail.applicationStatus
  const error = loading ? '' : detail.error

  async function apply(event) {
    event.preventDefault()
    setSubmitting(true)
    setApplyError('')
    try {
      const formData = new FormData(event.currentTarget)
      const result = await apiRequest(`/api/offers/${encodeURIComponent(offer.id)}/applications`, {
        method: 'POST',
        body: { message: formData.get('message') },
      })
      setDetail((current) => ({ ...current, applicationStatus: result.status }))
    } catch (requestError) {
      setApplyError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="container offers-detail-status" role="status">Loading campaign details…</div>
  if (error) return <div className="container offers-detail-status"><p className="offers-error" role="alert">{error}</p><Link to="/offers">Back to the marketplace</Link></div>
  if (!offer) return null

  const canApply = user?.role === 'publisher' && user.status === 'approved' && !offer.isDemo && !applicationStatus
  const payout = formatPayout(offer)
  const terms = [
    ['Payment terms', offer.paymentTerms],
    ['Payout method', offer.payoutMethod],
    ['States', Array.isArray(offer.states) && offer.states.length ? offer.states.join(', ') : null],
    ['Schedule', offer.schedule],
    ['Percentage', offer.percentage !== null && offer.percentage !== undefined ? `${offer.percentage}%` : null],
    ['Date available', offer.dateAvailable || offer.availableFrom],
    ['Buffer', offer.bufferSeconds !== null && offer.bufferSeconds !== undefined ? `${offer.bufferSeconds} seconds` : null],
  ].filter(([, value]) => value !== null && value !== undefined && value !== '')
  return (
    <article className="offer-detail">
      <header className="offer-detail-hero">
        <div className="container offer-detail-hero-inner">
          <Link className="offers-back-link" to="/offers">← All offers</Link>
          <p className="section-kicker">{[offer.productType, offer.campaignType].filter(Boolean).join(' · ')}</p>
          <h1>{offer.title}</h1>
          {(offer.industry || offer.vertical) && <p>{[offer.industry, offer.vertical].filter(Boolean).join(' / ')}</p>}
          {offer.isDemo && <p className="offer-demo-notice">Development demo only — this is not live Ringstack inventory and cannot receive applications.</p>}
        </div>
      </header>
      <div className="container offer-detail-layout">
        <div className="offer-detail-copy">
          {offer.description && <section>
            <p className="section-kicker">Campaign overview</p>
            <h2>Requirements at a glance</h2>
            <p>{offer.description}</p>
          </section>}
          {offer.qualificationRequirements && <section>
            <p className="section-kicker">Qualification</p>
            <h2>Who this campaign is for</h2>
            <p>{offer.qualificationRequirements}</p>
          </section>}
          {offer.trafficRequirements && <section>
            <p className="section-kicker">Traffic</p>
            <h2>Traffic requirements</h2>
            <p>{offer.trafficRequirements}</p>
          </section>}
          {Array.isArray(offer.requirements) && offer.requirements.length > 0 && (
            <section>
              <p className="section-kicker">Requirements</p>
              <h2>Campaign requirements</h2>
              <ul className="offer-restrictions">{offer.requirements.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
          )}
          {Array.isArray(offer.restrictions) && offer.restrictions.length > 0 && (
            <section>
              <p className="section-kicker">Important</p>
              <h2>Restrictions</h2>
              <ul className="offer-restrictions">{offer.restrictions.map((item) => <li key={item}>{item}</li>)}</ul>
            </section>
          )}
        </div>
        <aside className="offer-detail-aside">
          <p className="section-kicker">Offer terms</p>
          {payout && <h2>{payout}</h2>}
          <dl className="offer-terms">
            {terms.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}
          </dl>
          {applicationStatus && (
            <p className="offer-application-status" role="status">
              {applicationStatus === 'pending' && 'Your application is pending review.'}
              {applicationStatus === 'approved' && 'Your application is approved.'}
              {applicationStatus === 'rejected' && 'Your application was not approved. Contact Ringstack if you have questions.'}
            </p>
          )}
          {canApply && (
            <form className="offer-apply-form" onSubmit={apply}>
              <label htmlFor="application-message">Note for the Ringstack team <span>(optional)</span></label>
              <textarea id="application-message" name="message" rows="3" maxLength="1200" />
              {applyError && <p className="offers-error" role="alert">{applyError}</p>}
              <button className="button button-primary" type="submit" disabled={submitting}>{submitting ? 'Submitting…' : 'Apply to this offer'}</button>
            </form>
          )}
          {!user && !offer.isDemo && !applicationStatus && (
            <p className="offer-login-prompt">Approved publisher? <Link to="/publisher/login">Sign in to apply</Link>. New to Ringstack? <Link to="/publisher/register">Apply for a publisher account</Link>.</p>
          )}
          {user?.role === 'advertiser' && !offer.isDemo && (
            <p className="offer-login-prompt">Offer applications are available to publishers. <Link to="/publisher/login">Publisher sign in</Link>.</p>
          )}
          {user?.role === 'publisher' && user.status !== 'approved' && !offer.isDemo && (
            <p className="offer-login-prompt">Publisher account approval is required before applying.</p>
          )}
        </aside>
      </div>
    </article>
  )
}

export default function Offers() {
  const { offerId } = useParams()
  return offerId ? <OfferDetail /> : <OffersListing />
}
