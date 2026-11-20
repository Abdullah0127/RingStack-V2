import { Link, useParams } from "react-router-dom";
import blogPosts from "../data/blogPosts.js";
import PageHero from "../components/PageHero.jsx";
export default function BlogPost() {
  const { slug } = useParams();
  const post = blogPosts.find((x) => x.slug === slug);
  if (!post)
    return (
      <section className="container not-found">
        <p className="section-kicker">Article not found</p>
        <h1>This article is unavailable.</h1>
        <Link className="button button-primary" to="/blog">
          Browse insights
        </Link>
      </section>
    );
  return (
    <>
      <PageHero
        eyebrow={`${post.category} · ${post.dateLabel} · ${post.readTime}`}
        title={post.title}
        intro={post.excerpt}
        image={post.category === "Compliance" ? "documents" : "meeting"}
      />
      <article className="container section article">
        <Link className="card-link" to="/blog">
          ← All insights
        </Link>
        {post.isSample && (
          <p className="article-sample-banner" role="note">
            Sample editorial content — this post has not been reviewed or
            approved for publication.
          </p>
        )}
        <div className="article-body">
          <p>{post.intro}</p>
          {post.sections.map((s) => (
            <section key={s.heading}>
              <h2>{s.heading}</h2>
              {s.paragraphs.map((p) => (
                <p key={p}>{p}</p>
              ))}
              {s.bullets && (
                <ul>
                  {s.bullets.map((x) => (
                    <li key={x}>{x}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
        <Link className="button button-primary" to="/contact">
          Discuss a campaign
        </Link>
      </article>
    </>
  );
}
