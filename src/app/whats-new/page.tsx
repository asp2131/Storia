import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteFooter, SiteNav } from "@/components/SiteChrome";
import { ARTICLES, formatArticleDate } from "@/content/whats-new";
import "@/components/StoriaCalmLanding.css";

export const metadata: Metadata = {
  title: "What's new",
  description: "News from Loratone: product updates, milestones, and the people helping us build a reading app for every kid.",
};

export default function WhatsNewPage() {
  return (
    <div className="storia-calm">
      <SiteNav solid />
      <main className="wn-page">
        <header className="wn-head">
          <p className="eyebrow">What&apos;s new</p>
          <h1>News from the Loratone desk.</h1>
          <p className="lede">
            Product updates, milestones, and the people helping us build a
            reading app for every kid.
          </p>
        </header>
        <div className="news-grid">
          {ARTICLES.map((article) => (
            <Link className="news-card" href={`/whats-new/${article.slug}`} key={article.slug}>
              <div className={`news-cover news-${article.category.toLowerCase()}`}>
                {article.cover ? (
                  <Image src={article.cover.src} alt={article.cover.alt} fill sizes="(max-width: 900px) 100vw, 400px" />
                ) : (
                  <span className="news-cover-mark" aria-hidden="true">{article.category}</span>
                )}
              </div>
              <p className="news-meta">
                {article.category} · {formatArticleDate(article.date)}
              </p>
              <h2 className="news-title">{article.title}</h2>
              <p className="news-summary">{article.summary}</p>
            </Link>
          ))}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
