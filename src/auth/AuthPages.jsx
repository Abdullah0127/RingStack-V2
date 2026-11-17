import { useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { BRAND, CONTACT_EMAIL } from '../data/siteContent.js'
import { useAuth } from './useAuth.js'
import { ApiError, apiRequest } from './api.js'

const roleLabels = {
  advertiser: 'Advertiser',
  publisher: 'Publisher',
}

const roleStories = {
  advertiser: {
    title: 'Build campaigns around the customers you can help.',
    intro: 'A dedicated space for Ringstack advertiser partners.',
    image: 'advertiser',
  },
  publisher: {
    title: 'Find partnerships that fit your audience.',
    intro: 'A dedicated space for Ringstack publisher partners.',
    image: 'publisher',
  },
}

function AuthShell({ role, children }) {
  const story = roleStories[role]
  return (
    <div className="auth-page">
      <section className={`auth-visual auth-visual--${story.image}`} aria-label={`${roleLabels[role]} account`}>
        <Link className="auth-brand" to="/">
          <span className="brand-mark" aria-hidden="true">R</span>{BRAND}
        </Link>
        <div className="auth-visual-copy">
          <p className="section-kicker">{roleLabels[role]} portal</p>
          <h1>{story.title}</h1>
          <p>{story.intro}</p>
        </div>
        <Link className="auth-home-link" to="/">Return to the Ringstack website <span aria-hidden="true">→</span></Link>
      </section>
      <section className="auth-panel">
        <div className="auth-panel-inner">
          <Link className="auth-mobile-brand" to="/">
            <span className="brand-mark" aria-hidden="true">R</span>{BRAND}
          </Link>
          {children}
          <p className="auth-help">Need help? <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
        </div>
      </section>
    </div>
  )
}

function PasswordField({ id = 'password', name = 'password', label = 'Password', autoComplete = 'current-password', ...props }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="auth-password-field">
      <label htmlFor={id}>{label}</label>
      <div className="auth-password-control">
        <input id={id} name={name} type={visible ? 'text' : 'password'} autoComplete={autoComplete} required {...props} />
        <button type="button" className="auth-password-toggle" onClick={() => setVisible((value) => !value)} aria-label={visible ? 'Hide password' : 'Show password'}>
          {visible ? 'Hide' : 'Show'}
        </button>
      </div>
    </div>
  )
}

function AuthMessage({ children, error = false }) {
  if (!children) return null
  return <p className={`auth-message${error ? ' auth-message--error' : ''}`} role={error ? 'alert' : 'status'}>{children}</p>
}

function LoginForm({ role }) {
  const { signIn, user, loading } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!loading && user) navigate(`/${user.role}/dashboard`, { replace: true })
  }, [loading, navigate, user])

  async function submit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    const form = event.currentTarget
    const formData = new FormData(form)
    try {
      await signIn(role, {
        email: formData.get('email'),
        password: formData.get('password'),
        rememberMe: formData.get('rememberMe') === 'on',
      })
      const next = location.state?.from?.pathname
      navigate(next?.startsWith(`/${role}/`) ? next : `/${role}/dashboard`, { replace: true })
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <p className="auth-loading" role="status">Checking your account…</p>
  if (user) return null

  return (
    <>
      <p className="section-kicker">{roleLabels[role]} access</p>
      <h2>Welcome back</h2>
      <p className="auth-intro">Sign in to your Ringstack {role} account.</p>
      <form className="auth-form" onSubmit={submit}>
        <label htmlFor="email">Work email</label>
        <input id="email" name="email" type="email" autoComplete="username" maxLength="254" required />
        <PasswordField minLength="1" maxLength="128" />
        <div className="auth-form-options">
          <label className="auth-check"><input type="checkbox" name="rememberMe" /> <span>Remember me for 30 days</span></label>
          <Link to={`/${role}/forgot-password`}>Forgot password?</Link>
        </div>
        <AuthMessage error>{error}</AuthMessage>
        <button className="button button-primary auth-submit" type="submit" disabled={submitting}>
          {submitting ? 'Signing in…' : `Sign in as ${roleLabels[role].toLowerCase()}`}
        </button>
      </form>
      <p className="auth-switch">New to Ringstack? <Link to={`/${role}/register`}>Apply for an account</Link></p>
      <p className="auth-switch">Looking for the other portal? <Link to={`/${role === 'advertiser' ? 'publisher' : 'advertiser'}/login`}>Sign in as {role === 'advertiser' ? 'a publisher' : 'an advertiser'}</Link></p>
    </>
  )
}

function RegistrationForm({ role }) {
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [accountType, setAccountType] = useState('individual')
  const roleLabel = roleLabels[role]

  async function submit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')
    const form = event.currentTarget
    const formData = new FormData(form)
    const body = {
      firstName: formData.get('firstName'),
      lastName: formData.get('lastName'),
      email: formData.get('email'),
      password: formData.get('password'),
      website: formData.get('website'),
      companyName: formData.get('companyName'),
      acceptTerms: formData.get('acceptTerms') === 'on',
    }
    if (role === 'advertiser') {
      body.teamSize = formData.get('teamSize')
      body.vertical = formData.get('vertical')
      body.campaignNeeds = formData.get('campaignNeeds')
    } else {
      body.accountType = accountType
      body.country = formData.get('country')
      body.trafficSources = formData.getAll('trafficSources')
      body.monthlyLeads = formData.get('monthlyLeads')
      body.complianceConfirmed = formData.get('complianceConfirmed') === 'on'
      if (body.trafficSources.length === 0) {
        setError('Select at least one traffic source.')
        setSubmitting(false)
        return
      }
    }
    try {
      const result = await apiRequest(`/api/auth/register/${role}`, { method: 'POST', body })
      setMessage(result.message)
      form.reset()
      setAccountType('individual')
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <p className="section-kicker">{roleLabel} application</p>
      <h2>Apply for an account</h2>
      <p className="auth-intro">Tell us a little about your {role === 'advertiser' ? 'business and campaign needs' : 'publishing activity'}. Applications are reviewed before access is approved.</p>
      <form className="auth-form auth-form--registration" onSubmit={submit}>
        <div className="auth-field-pair">
          <div><label htmlFor="firstName">First name</label><input id="firstName" name="firstName" autoComplete="given-name" maxLength="80" required /></div>
          <div><label htmlFor="lastName">Last name</label><input id="lastName" name="lastName" autoComplete="family-name" maxLength="80" required /></div>
        </div>
        <label htmlFor="email">Work email</label>
        <input id="email" name="email" type="email" autoComplete="email" maxLength="254" required />
        <PasswordField label="Create password" autoComplete="new-password" minLength="12" maxLength="128" />
        <p className="auth-field-note">Use 12–128 characters.</p>
        {role === 'publisher' && (
          <fieldset className="auth-fieldset">
            <legend>Account type</legend>
            <div className="auth-choice-row">
              <label className="auth-check"><input type="radio" name="accountType" value="individual" checked={accountType === 'individual'} onChange={() => setAccountType('individual')} /> <span>Individual</span></label>
              <label className="auth-check"><input type="radio" name="accountType" value="business" checked={accountType === 'business'} onChange={() => setAccountType('business')} /> <span>Business</span></label>
            </div>
          </fieldset>
        )}
        {role === 'advertiser' && (
          <>
            <label htmlFor="companyName">Business name</label>
            <input id="companyName" name="companyName" autoComplete="organization" maxLength="160" required />
            <label htmlFor="teamSize">Sales team size</label>
            <select id="teamSize" name="teamSize" required defaultValue=""><option value="" disabled>Select team size</option><option value="1">1</option><option value="2-5">2–5</option><option value="5-25">5–25</option><option value="25+">25+</option></select>
            <label htmlFor="vertical">Primary industry</label>
            <select id="vertical" name="vertical" required defaultValue=""><option value="" disabled>Select an industry</option><option value="insurance">Insurance</option><option value="financial-services">Financial services</option><option value="home-services">Home services</option><option value="legal">Legal</option><option value="travel">Travel</option><option value="real-estate">Real estate</option></select>
            <label htmlFor="campaignNeeds">What would you like to achieve? <span>(optional)</span></label>
            <textarea id="campaignNeeds" name="campaignNeeds" maxLength="1200" rows="3" />
          </>
        )}
        {role === 'publisher' && (
          <>
            {accountType === 'business' && <><label htmlFor="companyName">Business name</label><input id="companyName" name="companyName" autoComplete="organization" maxLength="160" required /></>}
            <label htmlFor="website">Website <span>(optional)</span></label>
            <input id="website" name="website" type="url" autoComplete="url" maxLength="2048" placeholder="https://" />
            <label htmlFor="country">Country</label>
            <input id="country" name="country" autoComplete="country-name" maxLength="80" required />
            <fieldset className="auth-fieldset">
              <legend>How do you generate traffic? <span>(select all that apply)</span></legend>
              <div className="auth-choice-grid">
                <label className="auth-check"><input type="checkbox" name="trafficSources" value="owned-website" /> <span>Owned website</span></label>
                <label className="auth-check"><input type="checkbox" name="trafficSources" value="paid-search" /> <span>Paid search</span></label>
                <label className="auth-check"><input type="checkbox" name="trafficSources" value="paid-social" /> <span>Paid social</span></label>
                <label className="auth-check"><input type="checkbox" name="trafficSources" value="call-centre" /> <span>Call centre</span></label>
                <label className="auth-check"><input type="checkbox" name="trafficSources" value="other" /> <span>Other</span></label>
              </div>
            </fieldset>
            <label htmlFor="monthlyLeads">Estimated monthly leads</label>
            <select id="monthlyLeads" name="monthlyLeads" required defaultValue=""><option value="" disabled>Select a range</option><option value="under-100">Under 100</option><option value="100-1000">100–1,000</option><option value="over-1000">Over 1,000</option><option value="not-sure">Not sure</option></select>
            <label className="auth-check auth-compliance"><input type="checkbox" name="complianceConfirmed" required /> <span>I confirm that my traffic and data practices meet applicable requirements.</span></label>
          </>
        )}
        <label className="auth-check auth-terms"><input type="checkbox" name="acceptTerms" required /> <span>I have read the <Link to="/privacy" target="_blank" rel="noreferrer">Privacy information</Link> and <Link to="/terms" target="_blank" rel="noreferrer">Website terms</Link>.</span></label>
        <AuthMessage error>{error}</AuthMessage>
        <AuthMessage>{message}</AuthMessage>
        <button className="button button-primary auth-submit" type="submit" disabled={submitting}>
          {submitting ? 'Sending application…' : 'Submit application'}
        </button>
      </form>
      <p className="auth-switch">Already applied? <Link to={`/${role}/login`}>Sign in</Link></p>
    </>
  )
}

function ForgotPasswordForm({ role }) {
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function submit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')
    const formData = new FormData(event.currentTarget)
    try {
      const result = await apiRequest(`/api/auth/forgot-password/${role}`, {
        method: 'POST',
        body: { email: formData.get('email') },
      })
      setMessage(result.message)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <p className="section-kicker">{roleLabels[role]} account</p>
      <h2>Reset your password</h2>
      <p className="auth-intro">Enter the email address associated with this portal. If it matches an account, we’ll send a reset link.</p>
      <form className="auth-form" onSubmit={submit}>
        <label htmlFor="email">Work email</label>
        <input id="email" name="email" type="email" autoComplete="email" maxLength="254" required />
        <AuthMessage error>{error}</AuthMessage>
        <AuthMessage>{message}</AuthMessage>
        <button className="button button-primary auth-submit" type="submit" disabled={submitting}>{submitting ? 'Sending…' : 'Email reset link'}</button>
      </form>
      <p className="auth-switch"><Link to={`/${role}/login`}>← Back to sign in</Link></p>
    </>
  )
}

function ResetPasswordForm({ role }) {
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const token = new URLSearchParams(window.location.search).get('token') || ''

  async function submit(event) {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    setMessage('')
    const formData = new FormData(event.currentTarget)
    const password = formData.get('password')
    if (password !== formData.get('confirmPassword')) {
      setError('The passwords do not match.')
      setSubmitting(false)
      return
    }
    try {
      const result = await apiRequest(`/api/auth/reset-password/${role}`, {
        method: 'POST',
        body: { token, password },
      })
      setMessage(result.message)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <p className="section-kicker">{roleLabels[role]} account</p>
      <h2>Choose a new password</h2>
      <p className="auth-intro">Set a new password for your Ringstack account.</p>
      <form className="auth-form" onSubmit={submit}>
        <PasswordField label="New password" autoComplete="new-password" minLength="12" maxLength="128" />
        <PasswordField id="confirmPassword" name="confirmPassword" label="Confirm new password" autoComplete="new-password" minLength="12" maxLength="128" />
        <p className="auth-field-note">Use 12–128 characters.</p>
        <AuthMessage error>{error}</AuthMessage>
        <AuthMessage>{message}</AuthMessage>
        <button className="button button-primary auth-submit" type="submit" disabled={submitting || !token || Boolean(message)}>{submitting ? 'Updating…' : 'Update password'}</button>
      </form>
      <p className="auth-switch"><Link to={`/${role}/login`}>Return to sign in</Link></p>
    </>
  )
}

export function AuthPage({ role, mode }) {
  const { user, loading } = useAuth()
  useEffect(() => {
    const modeNames = { login: 'Sign in', register: 'Apply', forgot: 'Password recovery', reset: 'Reset password' }
    document.title = `${roleLabels[role]} ${modeNames[mode]} | ${BRAND}`
    document.querySelector('meta[name="description"]')?.setAttribute('content', `${roleLabels[role]} account access for Ringstack partners.`)
  }, [mode, role])
  if (loading) return <AuthShell role={role}><p className="auth-loading" role="status">Checking your account…</p></AuthShell>
  if (user && mode === 'login') return <Navigate to={`/${user.role}/dashboard`} replace />
  const titles = {
    login: `${roleLabels[role]} sign in`,
    register: `${roleLabels[role]} application`,
    forgot: 'Password recovery',
    reset: 'Reset your password',
  }
  return (
    <AuthShell role={role}>
      <h1 className="auth-page-title">{titles[mode]}</h1>
      {mode === 'login' && <LoginForm role={role} />}
      {mode === 'register' && <RegistrationForm role={role} />}
      {mode === 'forgot' && <ForgotPasswordForm role={role} />}
      {mode === 'reset' && <ResetPasswordForm role={role} />}
    </AuthShell>
  )
}

export function PortalDashboard({ role }) {
  const { user, loading, sessionError, refreshSession, signOut } = useAuth()
  const navigate = useNavigate()
  const [portalCheck, setPortalCheck] = useState({ role: '', verified: false, error: '' })
  const [publisherSummary, setPublisherSummary] = useState(null)
  const [logoutError, setLogoutError] = useState('')
  const [signingOut, setSigningOut] = useState(false)

  useEffect(() => {
    let active = true
    if (!loading && user?.role === role) {
      apiRequest(`/api/portal/${role}`).then((result) => {
        if (active && result.user.role === role && result.user.status === 'approved') {
          setPortalCheck({ role, verified: true, error: '' })
          if (role === 'publisher') setPublisherSummary(result)
        }
        else if (active) setPortalCheck({ role, verified: false, error: 'Ringstack could not verify access to this portal. Please sign in again.' })
      }).catch(async (error) => {
        if (error instanceof ApiError && error.status === 401) {
          await refreshSession()
          return
        }
        if (active) setPortalCheck({ role, verified: false, error: error.message })
      })
    }
    return () => { active = false }
  }, [loading, refreshSession, role, user])

  if (loading) return <main className="portal-page"><p role="status">Checking your account…</p></main>
  if (sessionError) return <main className="portal-page"><p className="auth-message auth-message--error" role="alert">{sessionError}</p><Link to={`/${role}/login`}>Return to sign in</Link></main>
  if (!user) return <Navigate to={`/${role}/login`} state={{ from: { pathname: `/${role}/dashboard` } }} replace />
  if (user.role !== role) return <Navigate to={`/${user.role}/dashboard`} replace />
  if (portalCheck.role === role && portalCheck.error) return (
    <main className="portal-page">
      <p className="auth-message auth-message--error" role="alert">{portalCheck.error}</p>
      <button type="button" className="button button-secondary" onClick={logout} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
      <AuthMessage error>{logoutError}</AuthMessage>
    </main>
  )
  if (portalCheck.role !== role || !portalCheck.verified) return <main className="portal-page"><p role="status">Verifying portal access…</p></main>

  async function logout() {
    setSigningOut(true)
    setLogoutError('')
    try {
      await signOut()
      navigate(`/${role}/login`, { replace: true })
    } catch (error) {
      setLogoutError(error.message)
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <main className="portal-page">
      <header className="portal-header">
        <Link className="auth-brand" to="/"><span className="brand-mark" aria-hidden="true">R</span>{BRAND}</Link>
        <button type="button" className="button button-secondary" onClick={logout} disabled={signingOut}>{signingOut ? 'Signing out…' : 'Sign out'}</button>
      </header>
      <section className="portal-content">
        <p className="section-kicker">{roleLabels[role]} portal</p>
        <h1>Welcome, {user.fullName}</h1>
        <p>Your {role} account is approved and signed in as <strong>{user.email}</strong>.</p>
        {role === 'publisher' ? (
          <section className="portal-marketplace">
            <div className="portal-marketplace-heading">
              <div>
                <p className="section-kicker">Publisher opportunities</p>
                <h2>Offers marketplace</h2>
              </div>
              <Link className="button button-primary" to="/offers">Browse offers</Link>
            </div>
            <p>{publisherSummary?.activeOffers ?? 0} active {publisherSummary?.activeOffers === 1 ? 'offer' : 'offers'} currently configured.</p>
            {publisherSummary?.developmentDemoInventory && <p className="portal-demo-note">Development environment: offer previews marked “Development demo” are examples only and cannot receive applications.</p>}
            <h3>Your offer applications</h3>
            {publisherSummary?.applications?.length ? (
              <ul className="portal-application-list">
                {publisherSummary.applications.map((application) => (
                  <li key={application.offerId}>
                    {application.offerStatus === 'active'
                      ? <Link to={`/offers/${encodeURIComponent(application.offerId)}`}>{application.offerTitle}</Link>
                      : <span>{application.offerTitle}</span>}
                    <span className={`portal-application-status portal-application-status--${application.status}`}>{application.status}</span>
                  </li>
                ))}
              </ul>
            ) : <p>You have not applied to an offer yet.</p>}
          </section>
        ) : (
          <p className="portal-note">Advertiser campaign management is not available in this portal yet. Contact Ringstack to discuss campaign setup and access.</p>
        )}
        <AuthMessage error>{logoutError}</AuthMessage>
        {role === 'advertiser' && <Link className="button button-primary" to="/">Return to Ringstack</Link>}
      </section>
    </main>
  )
}
