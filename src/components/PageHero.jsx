export default function PageHero({ eyebrow, title, intro, image = 'team' }) {
  return (
    <header className="page-hero page-hero--editorial">
      <div className="container page-hero-layout">
        <div className="page-hero-copy">
          <p className="section-kicker">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{intro}</p>
        </div>
        <div className="page-hero-image" data-image={image} aria-hidden="true" />
      </div>
    </header>
  )
}
