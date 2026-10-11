import Image from "next/image";
import type { ReactNode } from "react";

// ponytail: articles live in code. Move to the DB/admin once non-devs need to publish.
export type WhatsNewArticle = {
  slug: string;
  title: string;
  date: string; // ISO yyyy-mm-dd
  category: "Milestone" | "Community" | "Product";
  summary: string;
  cover?: { src: string; alt: string };
  body: ReactNode;
};

const TULANE_ARTICLE_URL =
  "https://innovation.tulane.edu/oralexamai-takes-top-prize-tulanes-fall-2026-open-season-pitch-competition";

export const ARTICLES: WhatsNewArticle[] = [
  {
    slug: "community-conversations-q3-2026",
    title: "A season of listening: SLPs, authors, and educators",
    date: "2026-09-29",
    category: "Community",
    summary:
      "This quarter we took Loratone to the people who know young readers best — and came back with a notebook full of ideas.",
    cover: {
      src: "/whats-new/team-with-lori-reyes.jpg",
      alt: "Akintunde and Shivang at a café table with speech-language pathologist Lori Reyes",
    },
    body: (
      <>
        <p>
          Loratone is built for every kind of reader, so we can&apos;t build it
          alone. This quarter we spent a lot of time away from our laptops and
          across the table from people who work with children, books, and
          schools every day.
        </p>
        <figure>
          <Image
            src="/whats-new/team-with-lori-reyes.jpg"
            width={1202}
            height={1600}
            sizes="(max-width: 760px) 100vw, 720px"
            alt="Akintunde and Shivang at a café table with speech-language pathologist Lori Reyes"
          />
          <figcaption>With speech-language pathologist Lori Reyes.</figcaption>
        </figure>
        <p>
          Speech-language pathologists see first-hand how sound, rhythm, and
          repetition help kids build language. Time with Lori Reyes pushed us to
          keep narration clear and paced for listeners who need a little more
          time with each word.
        </p>
        <figure>
          <Image
            src="/whats-new/team-with-camron-irving.jpg"
            width={1600}
            height={1200}
            sizes="(max-width: 760px) 100vw, 720px"
            alt="The Loratone team with author Camron Irving, who is holding up a book"
          />
          <figcaption>With author and Posse Foundation alum Camron Irving.</figcaption>
        </figure>
        <p>
          We also met with authors who want their stories to reach more kids.
          Every conversation like this one grows the kinds of voices and stories
          we can bring onto the Loratone shelf.
        </p>
        <figure>
          <Image
            src="/whats-new/team-with-matt-candler.jpg"
            width={1600}
            height={1200}
            sizes="(max-width: 760px) 100vw, 720px"
            alt="Shivang and Akintunde with Matt Candler, founder of 4.0 Schools"
          />
          <figcaption>With Matt Candler, founder of 4.0 Schools.</figcaption>
        </figure>
        <p>
          Matt Candler has spent years helping New Orleans educators turn ideas
          into schools and ventures. We&apos;re grateful for his time and his
          candor about building something that lasts.
        </p>
        <figure>
          <Image
            src="/whats-new/shiv-with-posse-alum.jpg"
            width={1200}
            height={1600}
            sizes="(max-width: 760px) 100vw, 720px"
            alt="Shivang smiling with a fellow Posse Foundation alum"
          />
          <figcaption>Shivang with a fellow Posse Foundation alum.</figcaption>
        </figure>
        <p>
          The Posse Foundation network keeps showing up for us, and we&apos;re
          proud to be part of it. Thank you to everyone who made time for us
          this quarter. If you&apos;re an educator, clinician, or author who
          wants to help shape Loratone, email us at{" "}
          <a href="mailto:hello@loratone.kids">hello@loratone.kids</a>.
        </p>
      </>
    ),
  },
  {
    slug: "tulane-open-season-fall-2026",
    title: "Loratone places 3rd at Tulane's Open Season pitch competition",
    date: "2026-09-21",
    category: "Milestone",
    summary:
      "Out of ten finalists, Loratone took third place at the Tulane Innovation Institute's Fall 2026 Open Season.",
    body: (
      <>
        <p>
          On September 15, co-founders Shivang Thakor and Akintunde Pounds
          pitched Loratone on stage at The Josephine at the Tulane Innovation
          Institute&apos;s Fall 2026 Open Season pitch competition. Loratone took{" "}
          <strong>3rd place and a $750 prize</strong> out of ten finalists.
        </p>
        <p>
          We pitched Loratone as a sensory-regulation platform synced to story:
          narration, word-by-word highlighting, and soundscapes that make
          reading more accessible, especially for neurodivergent learners.
        </p>
        <p>
          This was the first Open Season open to the wider New Orleans
          community. Congratulations to OralExam.ai on first place and
          Usufruct on second, and thanks to the judges and the Tulane
          Innovation Institute team.
        </p>
        <p>
          Shivang and Akintunde are also part of the Institute&apos;s year-long
          Startup Team Mentoring program. The prize goes straight back into
          more stories and more readers.
        </p>
        <p>
          <a href={TULANE_ARTICLE_URL} target="_blank" rel="noopener noreferrer">
            Read the Tulane Innovation Institute announcement →
          </a>
        </p>
      </>
    ),
  },
];

export function getArticle(slug: string) {
  return ARTICLES.find((article) => article.slug === slug);
}

export function formatArticleDate(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
