import { Link } from "react-router-dom";
import blogPosts from "../data/blogPosts.js";

export default function BpoServicesPage() {
  const bpoPosts = blogPosts
    .filter((post) =>
      [
        "BPO Operations",
        "Call Operations",
        "Lead Generation",
        "Customer Support",
        "Technology",
      ].includes(post.category),
    )
    .slice(0, 5);
  const services = [
    [
      "Customer support",
      "Responsive, documented support that matches customer needs and agreed service boundaries.",
    ],
    [
      "Call center operations",
      "Inbound coverage planning, routing, quality review and operational reporting.",
    ],
    [
      "Lead generation",
      "Enquiry handling and qualification built around clear campaign requirements.",
    ],
    [
      "Sales and appointments",
      "Structured appointment-setting and sales workflows with agreed scripts and review points.",
    ],
  ];
  return (
    <article className="bpo-page">
      <header className="bpo-hero">
        <div className="container bpo-hero-grid">
          <div>
            <p className="section-kicker">BPO services and operations</p>
            <h1>Business support designed around the customer journey.</h1>
            <p>
              Ringstack campaigns can support calls, enquiries and campaign
              operations when scope, quality and reporting are agreed clearly.
            </p>
            <Link className="button button-primary" to="/contact">
              Discuss a service scope
            </Link>
          </div>
          <div
            className="bpo-hero-image"
            aria-label="Call and operations team"
          />
        </div>
      </header>
      <section className="bpo-overview">
        <div className="container bpo-overview-grid">
          <p className="section-kicker">
            Business process outsourcing overview
          </p>
          <h2>Outsourcing that begins with clearly defined work.</h2>
          <p>
            Define the process, service areas, handling criteria, reporting and
            escalation responsibilities before activity begins.
          </p>
        </div>
      </section>
      <section className="bpo-services-grid-section">
        <div className="container bpo-services-grid">
          {services.map(([title, text], index) => (
            <article key={title}>
              <span>0{index + 1}</span>
              <h2>{title}</h2>
              <p>{text}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="bpo-technology">
        <div className="container bpo-technology-grid">
          <div
            className="bpo-technology-image"
            aria-label="Operations technology"
          />
          <div>
            <p className="section-kicker">Technology and automation</p>
            <h2>Use technology to make work visible.</h2>
            <p>
              Routing, tracking, CRM handoffs and operational dashboards can
              support consistent processes. Automation should preserve review
              points and accountable exception handling.
            </p>
          </div>
        </div>
      </section>
      {bpoPosts.length > 0 && (
        <section className="bpo-featured">
          <div className="container bpo-featured-grid">
            <div
              className="bpo-featured-image"
              aria-label="Featured BPO article"
            />
            <article>
              <p className="section-kicker">
                Featured BPO article · Sample editorial
              </p>
              <h2>{bpoPosts[0].title}</h2>
              <p>{bpoPosts[0].excerpt}</p>
              <p className="article-sample-label">
                Sample editorial content — for review
              </p>
              <Link className="card-link" to={`/blog/${bpoPosts[0].slug}`}>
                Read the article →
              </Link>
            </article>
          </div>
        </section>
      )}
      <section className="bpo-insights">
        <div className="container">
          <p className="section-kicker">Latest BPO insights</p>
          <div className="bpo-insight-grid">
            {bpoPosts.map((post) => (
              <article key={post.slug}>
                <p>
                  {post.category} · {post.dateLabel}
                </p>
                <h2>{post.title}</h2>
                <span>{post.excerpt}</span>
                <Link className="card-link" to={`/blog/${post.slug}`}>
                  Read more →
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section className="bpo-related">
        <div className="container bpo-related-inner">
          <p className="section-kicker">Related articles</p>
          <div>
            {blogPosts
              .filter(
                (post) =>
                  post.category === "Lead Generation" ||
                  post.category === "Publisher partnerships" ||
                  post.category === "Call Operations",
              )
              .slice(0, 3)
              .map((post) => (
                <Link key={post.slug} to={`/blog/${post.slug}`}>
                  <span>{post.category}</span>
                  <strong>{post.title}</strong>
                  <i>→</i>
                </Link>
              ))}
          </div>
        </div>
      </section>
      <section className="bpo-consultation">
        <div className="container bpo-consultation-inner">
          <div>
            <p className="section-kicker">BPO consultation</p>
            <h2>Plan the support your operation needs.</h2>
          </div>
          <Link className="button button-on-inverse" to="/contact">
            Book a consultation
          </Link>
        </div>
      </section>
    </article>
  );
}
