export const HERO_CONTENT = {
  eyebrow: "For ages 4–10 · Made in New Orleans",
  headline: "A quiet place\nfor stories.",
  lede: "Loratone is a read-aloud storybook app for children — warm narration, gentle soundscapes, and tales made to be heard.",
  primaryCta: {
    label: "Download on iOS",
    href: "https://apps.apple.com/us/app/storia-kids/id6759848322",
  },
  secondaryCta: {
    label: "See how it works",
    href: "#how",
  },
  imageAlt: "A child reading Loratone",
  imageSrc: "/storia-landing/kid-ipad.jpg",
};

export const PROBLEM_CONTENT = {
  eyebrow: "Why this matters",
  stat: "67%",
  statContext: "of fourth-graders aren't reading at grade level.",
  lede: "We're building Loratone in response to that reality—because every story deserves to be heard, felt, and experienced in a way that helps kids stay engaged with reading.",
  sourceHref: "https://brighterly.com/blog/literacy-statistics/",
  sourceLabel: "Literacy statistics via Brighterly",
};

export const MISSION_CONTENT = {
  eyebrow: "Why we built this",
  headline: "Built by readers, for readers.",
  lede: "Loratone is a small team in New Orleans, making a slow, careful app with authors, librarians, and the kids who test every page.",
  founders: [
    {
      kicker: "01 / Founder",
      name: "Shivang Thakor",
      body: "For as long as Shivang can remember, he has read stories with sound by his side. In middle school, he would not read Romeo and Juliet unless he was listening to Pachelbel's Canon in D with birds chirping in the background. Now, as the first in his family to graduate from college as a Posse Foundation Scholar, he wants to serve readers like him who may have just needed a little sound to go with their stories.",
      imageSrc: "https://media.licdn.com/dms/image/v2/D4D03AQEo4pnSxy68Sw/profile-displayphoto-crop_800_800/B4DZhR7V6XH4AM-/0/1753721168705?e=1773878400&v=beta&t=nosQgcuiiijpr272bCzuMoCOlL9vI_WL1HCV1uAC-LE",
      imageAlt: "Shivang Thakor",
    },
    {
      kicker: "02 / Founder + Software Architect",
      name: "Akintunde Pounds",
      body: "As a parent to a daughter with autism, Akintunde is on a mission to bridge literacy gaps for all kids—especially children with disabilities. He and his brother come from a third-generation family of educators, and with 5+ years teaching computer science, he brings both lived empathy and classroom experience to how Loratone is built.",
      imageSrc: "https://avatars.githubusercontent.com/u/42776703?v=4",
      imageAlt: "Akintunde Pounds",
    },
  ],
  motivation: {
    kicker: "03 / Motivation",
    title: "Why We Built Loratone",
    body: "We built Loratone to redefine what a book can be. Our immersive sensory audiobooks are designed to strengthen foundational reading skills in children by supporting orthographic representation, phonological representation, and semantic representation in every story.",
  },
};

export const HOW_IT_WORKS_CONTENT = {
  eyebrow: "How it works",
  steps: [
    {
      key: "choose",
      number: "01 · Choose",
      title: "A library laid out like a map.",
      body: "Kids wander a hand-drawn story world and pick tales by mood, length, or hero. Over 60 stories and counting.",
      imageSrc: "/storia-landing/app-library.png",
      imageAlt: "Story library screen",
    },
    {
      key: "listen",
      number: "02 · Listen",
      title: "Real voices. Page by page.",
      body: "Every story is narrated by a human reader, with pauses, expression, and care. Kids can read along or simply listen.",
      imageSrc: "/storia-landing/app-reading.png",
      imageAlt: "Reading screen with narration",
    },
    {
      key: "feel",
      number: "03 · Feel",
      title: "Soundscapes that bring it close.",
      body: "A custom audio bed under each page — rain, footsteps, wind in the trees — composed to match the moment.",
      imageSrc: "/storia-landing/app-reading.png",
      imageAlt: "Reading screen with immersive soundscape",
    },
  ],
};

export const COMMUNITY_CONTENT = {
  eyebrow: "Our story",
  headline: "Built by readers, for readers.",
  lede: "Loratone is a small team in New Orleans, making a slow, careful app with authors, librarians, and the kids who test every page.",
  tiles: [
    { src: "/storia-landing/team-author.jpg", caption: "With author Cherelyn Poe" },
    { src: "/storia-landing/team-festival.png", caption: "Family Lit Fest, 2025" },
    { src: "/storia-landing/team-mayor.png", caption: "Meeting readers in Lafayette Square" },
    { src: "/storia-landing/mascot-waving.jpg", caption: "Meet the mascot" },
  ],
  quote: {
    text: "My kid loves Loratone. Her fav story so far is Danny's Cat.",
    attribution: "Shay Claiborne, parent and founder & CEO of MilestoneMate",
  },
};

export const FINAL_CTA_CONTENT = {
  mascotSrc: "/storia-landing/mascot-idle.png",
  mascotAlt: "Loratone mascot",
  headline: "Start tonight's story.",
  lede: "Free to try with a handful of tales. A family subscription unlocks the full library.",
  primaryCta: {
    label: "Download on the App Store",
    href: "https://apps.apple.com/us/app/storia-kids/id6759848322",
  },
  finePrint: "Android coming soon.",
};

export const BOOKS = [
  { title: "The Tortoise & the Hare", meta: "Longer adventure · 16 pages", cover: "bc-1" },
  { title: "Sweet Potato, Sweet Potato", meta: "By Cherelyn Poe · 13 pages", cover: "bc-2" },
  { title: "My Day at Grandma's", meta: "Quick read · 8 pages", cover: "bc-3" },
  { title: "Jax & Shini", meta: "Folk tale · 12 pages", cover: "bc-4" },
  { title: "The Quiet Owl", meta: "Bedtime · 10 pages", cover: "bc-5" },
  { title: "The Bayou Bell", meta: "Original · 14 pages", cover: "bc-6" },
  { title: "Moon & the Mango Tree", meta: "Adventure · 15 pages", cover: "bc-7" },
  { title: "Papa's Lullaby", meta: "Short & sweet · 6 pages", cover: "bc-8" },
];
