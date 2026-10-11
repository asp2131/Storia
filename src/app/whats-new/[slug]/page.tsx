import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteFooter, SiteNav } from "@/components/SiteChrome";
import { ARTICLES, formatArticleDate, getArticle } from "@/content/whats-new";
import "@/components/StoriaCalmLanding.css";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return ARTICLES.map((article) => ({ slug: article.slug }));
}

export const dynamicParams = false;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const article = getArticle((await params).slug);
  if (!article) return {};
  return {
    title: article.title,
    description: article.summary,
    openGraph: {
      title: article.title,
      description: article.summary,
      type: "article",
      publishedTime: article.date,
      ...(article.cover && { images: [{ url: article.cover.src, alt: article.cover.alt }] }),
    },
  };
}

export default async function WhatsNewArticlePage({ params }: Props) {
  const article = getArticle((await params).slug);
  if (!article) notFound();

  return (
    <div className="storia-calm">
      <SiteNav solid />
      <main className="wn-article">
        <Link className="wn-back" href="/whats-new">
          ← All updates
        </Link>
        <p className="eyebrow">
          {article.category} · <time dateTime={article.date}>{formatArticleDate(article.date)}</time>
        </p>
        <h1>{article.title}</h1>
        <p className="lede">{article.summary}</p>
        <div className="wn-body">{article.body}</div>
      </main>
      <SiteFooter />
    </div>
  );
}
