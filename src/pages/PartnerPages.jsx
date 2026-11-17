import { Link } from 'react-router-dom'
const cta = (title, link = '/contact', label = 'Start a conversation') => (
  <section className="partner-cta">
    <div className="container partner-cta-inner">
      <p className="section-kicker">Next step</p>
      <h2>{title}</h2>
      <Link className="button button-primary" to={link}>{label}</Link>
    </div>
  </section>
)

export function AboutPage() {
  const values = [
    ['Clarity', 'Requirements, responsibilities and commercial terms should be understandable.'],
    ['Relevance', 'A suitable audience and a well-defined customer need come before campaign scale.'],
    ['Accountability', 'Partners need a practical point of contact and a clear way to review outcomes.'],
  ]
  return (
    <article className="about-page partner-page">
      <header className="about-hero">
        <div className="container about-hero-grid">
          <div>
            <p className="section-kicker">About Ringstack</p>
            <h1>Performance partnerships, built on a clear brief.</h1>
            <p>Ringstack helps bring advertisers and publishers together around relevant calls and leads.</p>
          </div>
          <figure className="about-hero-image" aria-label="Business team discussing campaign plans" />
        </div>
      </header>
      <section className="about-who">
        <div className="container">
          <p className="section-kicker">Who we are</p>
          <div className="about-who-grid">
            <h2>A focused marketplace partner for calls and leads.</h2>
            <p>Our role is to help both sides explain what they need, assess campaign fit and agree how activity should be handled and measured.</p>
          </div>
        </div>
      </section>
      <section className="about-story">
        <div className="container about-story-grid">
          <div className="about-story-image" aria-label="Team collaboration" />
          <div>
            <p className="section-kicker">Our story</p>
            <h2>Clarity is more valuable than complexity.</h2>
            <p>We work from the premise that useful partnerships begin with a plain conversation: who needs the enquiry, what makes it suitable and how the customer should be handled.</p>
          </div>
        </div>
      </section>
      <section className="about-purpose">
        <div className="container about-purpose-grid">
          <div><p className="section-kicker">Mission</p><h2>Make campaign connections easier to understand.</h2></div>
          <div><p className="section-kicker">Vision</p><h2>A responsible, transparent performance marketplace.</h2></div>
        </div>
      </section>
      <section className="about-values">
        <div className="container">
          <p className="section-kicker">Our values</p>
          <div className="about-value-list">{values.map(([title, text], index)=><article key={title}><span>0{index + 1}</span><h3>{title}</h3><p>{text}</p></article>)}</div>
        </div>
      </section>
      <section className="about-work">
        <div className="container">
          <p className="section-kicker">How Ringstack works</p>
          <ol className="about-process">
            <li><span>01</span><h3>Understand the need</h3><p>Confirm the service, audience and handling team.</p></li>
            <li><span>02</span><h3>Agree requirements</h3><p>Set fit, qualification, routing and payment terms.</p></li>
            <li><span>03</span><h3>Review activity</h3><p>Use agreed reporting and feedback to make informed decisions.</p></li>
          </ol>
        </div>
      </section>
      {cta('Discuss the Ringstack marketplace approach')}
    </article>
  )
}

export function TechnologyPage() {
  return (
    <article className="technology-page partner-page">
      <header className="technology-hero">
        <div className="container technology-hero-grid">
          <div><p className="section-kicker">Ringstack technology</p><h1>See each campaign in context.</h1><p>Tracking, reporting and integrations should make call and lead activity easier to understand.</p></div>
          <div className="technology-workflow" aria-label="Campaign tracking workflow">
            <span>Source</span><i>→</i><span>Tracker</span><i>→</i><span>Route</span><i>→</i><span>Outcome</span>
          </div>
        </div>
      </header>
      <section className="technology-tracking">
        <div className="container">
          <p className="section-kicker">Tracking and attribution</p>
          <div className="technology-track-grid">
            <div><span>01</span><h2>Call tracking</h2><p>Use source and campaign context to understand inbound call activity, routing and agreed outcomes.</p></div>
            <div><span>02</span><h2>Lead tracking</h2><p>Carry relevant campaign fields into forms and delivery systems so enquiries can be reviewed consistently.</p></div>
          </div>
        </div>
      </section>
      <section className="technology-analytics">
        <div className="container technology-analytics-grid">
          <div className="technology-dashboard" aria-label="Campaign analytics diagram">
            <div className="dashboard-header"><span>Campaign view</span><b>Live</b></div>
            <div className="dashboard-bars"><i /><i /><i /><i /><i /><i /></div>
            <div className="dashboard-metrics"><span>Calls<strong>Context</strong></span><span>Quality<strong>Criteria</strong></span><span>Leads<strong>Routing</strong></span></div>
          </div>
          <div><p className="section-kicker">Campaign analytics</p><h2>Reporting that supports decisions.</h2><p>Review source, disposition, delivery and validation information alongside agreed campaign terms.</p></div>
        </div>
      </section>
      <section className="technology-dispositions">
        <div className="container">
          <p className="section-kicker">Reporting and dispositions</p>
          <div className="technology-disposition-list"><span>Connected</span><span>Qualified</span><span>Not eligible</span><span>Duplicate</span><span>Disputed</span></div>
        </div>
      </section>
      <section className="technology-integrations">
        <div className="container technology-integrations-grid">
          <div><p className="section-kicker">Automation and integrations</p><h2>Fit the tools already in your workflow.</h2></div>
          <div className="technology-integrations-copy"><p>Plan tracking handoffs, CRM delivery and reporting around documented fields and clear ownership.</p><Link className="card-link" to="/contact">Discuss integration requirements →</Link></div>
        </div>
      </section>
      {cta('Plan a clearer campaign technology setup', '/contact', 'Discuss technology')}
    </article>
  )
}

export function AdvertisersPage() {
  const verticals = ['Insurance', 'Financial services', 'Home services', 'Legal', 'Travel', 'Real estate', 'Health and wellness']
  return (
    <article className="advertisers-page partner-page">
      <header className="advertiser-hero">
        <div className="container advertiser-hero-grid">
          <div><p className="section-kicker">For advertisers</p><h1>Set the brief. Receive relevant demand.</h1><p>Plan inbound call and lead campaigns around your team’s capacity, coverage and customer criteria.</p></div>
          <div className="advertiser-hero-image" aria-label="Advertiser campaign planning" />
        </div>
      </header>
      <section className="advertiser-qualified">
        <div className="container advertiser-qualified-grid">
          <div><p className="section-kicker">Qualified calls and leads</p><h2>Start with the customer you can help.</h2></div>
          <p>Agree service areas, eligibility, operating hours and the information that makes an enquiry relevant before traffic begins.</p>
        </div>
      </section>
      <section className="advertiser-types">
        <div className="container">
          <p className="section-kicker">Campaign types</p>
          <div className="advertiser-type-split"><article><span>CPA</span><h2>Performance outcomes</h2><p>Structure campaigns around agreed, validated calls or actions.</p></article><article><span>CPL</span><h2>Lead enquiries</h2><p>Define lead fields, validation and delivery for consistent follow-up.</p></article></div>
        </div>
      </section>
      <section className="advertiser-targeting">
        <div className="container advertiser-targeting-grid">
          <div className="advertiser-targeting-image" aria-label="Campaign audience planning" />
          <div><p className="section-kicker">Campaign targeting</p><h2>Target by need, location and timing.</h2><p>Shape campaign criteria around the customers your team is equipped to support.</p><div className="advertiser-verticals">{verticals.map((item)=><span key={item}>{item}</span>)}</div></div>
        </div>
      </section>
      <section className="advertiser-reporting">
        <div className="container"><p className="section-kicker">Performance reporting</p><h2>From activity to campaign decisions.</h2><div className="advertiser-reporting-line"><span>Source</span><span>Disposition</span><span>Quality</span><span>Outcome</span></div></div>
      </section>
      <section className="advertiser-onboarding">
        <div className="container advertiser-onboarding-grid"><div><p className="section-kicker">Advertiser onboarding</p><h2>A practical route from brief to campaign.</h2></div><ol><li>Campaign requirements</li><li>Tracking and routing</li><li>Validation and reporting</li><li>Campaign review</li></ol></div>
      </section>
      {cta('Create or access your advertiser account', '/advertiser/register', 'Advertiser application')}
    </article>
  )
}

export function PublishersPage() {
  return (
    <article className="publishers-page partner-page">
      <header className="publisher-hero">
        <div className="container publisher-hero-grid">
          <div><p className="section-kicker">For publishers</p><h1>Turn relevant traffic into agreed opportunities.</h1><p>Review campaigns, requirements and earning terms before choosing your next partnership.</p></div>
          <div className="publisher-hero-image" aria-label="Publisher performance workspace" />
        </div>
      </header>
      <section className="publisher-monetize">
        <div className="container publisher-monetize-grid"><div><p className="section-kicker">Monetize your traffic</p><h2>Match demand with an audience you understand.</h2></div><p>Choose campaign opportunities based on audience fit, geography, operating hours and a clear definition of payable outcomes.</p></div>
      </section>
      <section className="publisher-opportunities">
        <div className="container"><p className="section-kicker">Available campaign opportunities</p><div className="publisher-opportunity-list">
          <article><span>01</span><h2>Inbound calls</h2><p>Connect suitable callers to advertisers with clear qualification and schedule requirements.</p><Link to="/offers">Browse offers →</Link></article>
          <article><span>02</span><h2>Live transfers</h2><p>Review transfer criteria and handling expectations before agreeing to participation.</p><Link to="/offers">Review campaigns →</Link></article>
          <article><span>03</span><h2>Form leads</h2><p>Deliver consented, validated lead enquiries to agreed campaign destinations.</p><Link to="/offers">Explore opportunities →</Link></article>
        </div></div>
      </section>
      <section className="publisher-tracking">
        <div className="container publisher-tracking-grid"><div className="publisher-tracking-image" aria-label="Publisher analytics dashboard" /><div><p className="section-kicker">Tracking and reporting</p><h2>Understand delivery and outcome.</h2><p>Use source context, campaign reporting and agreed dispositions to review performance.</p></div></div>
      </section>
      <section className="publisher-payments">
        <div className="container publisher-payments-grid"><div><p className="section-kicker">Earnings and payments</p><h2>Know the terms before launch.</h2></div><div><p><strong>Payout model</strong> Confirm CPA, CPL or the specific payable outcome.</p><p><strong>Validation</strong> Review qualification, buffer and dispute rules.</p><p><strong>Payment terms</strong> Confirm schedule and settlement expectations.</p></div></div>
      </section>
      <section className="publisher-onboarding">
        <div className="container"><p className="section-kicker">Publisher onboarding</p><h2>Application, review and campaign fit.</h2><div className="publisher-onboarding-steps"><span>Apply</span><i>→</i><span>Account review</span><i>→</i><span>Campaign fit</span><i>→</i><span>Start</span></div></div>
      </section>
      {cta('Create or access your publisher account', '/publisher/register', 'Publisher application')}
    </article>
  )
}
