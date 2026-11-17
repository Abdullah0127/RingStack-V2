import { Link } from 'react-router-dom'
import { CtaBand, Section } from '../components/Sections.jsx'
import PageHero from '../components/PageHero.jsx'

export function DetailPage({ data, eyebrow = 'Ringstack', image = 'team' }) {
  return <div className="detail-page"><PageHero eyebrow={eyebrow} title={data.title} intro={data.intro} image={image}/><Section eyebrow="A considered approach" title="Campaigns shaped around the details"><div className="editorial-section-list">{data.sections.map((section,index)=><article className="editorial-section" key={section.title}><span className="editorial-index">0{index+1}</span><div><h3>{section.title}</h3><p>{section.text}</p></div></article>)}</div></Section><Section compact><div className="surface-inverse"><p className="section-kicker">Find a suitable next step</p><h2>Start with a clear conversation.</h2><p>Share your requirements and we’ll discuss campaign fit, expectations and possible next steps.</p><Link className="button button-primary" to="/contact">Talk to Ringstack</Link></div></Section></div>
}

export function IndustryIndex({ industries }) {
  return <><PageHero eyebrow="Industries" title="Campaigns for service-led businesses." intro="Explore the markets where Ringstack helps connect customer interest with the right team." image="meeting"/><Section eyebrow="Our markets" title="Choose an industry"><div className="three-grid industry-grid">{industries.map((industry,index)=><article className="card industry-card" key={industry.slug}><div className="industry-card-image" data-image={industry.slug} aria-hidden="true"/><div className="industry-card-copy"><span className="feature-icon" aria-hidden="true">{industry.icon}</span><p className="section-kicker">0{index+1} / Sector</p><h2>{industry.name}</h2><p>{industry.summary}</p><Link className="card-link" to={`/industries/${industry.slug}`}>Explore {industry.name} <span aria-hidden="true">→</span></Link></div></article>)}</div></Section><CtaBand/></>
}

export function PolicyPage({ title, intro, sections }) {
  return <><PageHero eyebrow="Ringstack policies" title={title} intro={intro} image="documents"/><Section eyebrow="Please read carefully" title="Information for website visitors"><div className="editorial-section-list policy-sections">{sections.map((section,index)=><article className="editorial-section" key={section.title}><span className="editorial-index">0{index+1}</span><div><h3>{section.title}</h3><p>{section.text}</p></div></article>)}</div><p className="policy-note">These pages describe general website information and should be reviewed against Ringstack’s actual processes and agreements before publication.</p></Section><CtaBand title="Need to ask us something?" intro="Send your question to the Ringstack team."/></>
}
