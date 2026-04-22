export const EASES = {
  reveal: "power3.out",
  emphasis: "power4.out",
  ambient: "sine.inOut",
  settle: "power2.out",
  snap: "power2.inOut",
} as const;

export const DURATIONS = {
  heroChar: 0.95,
  heroLine: 1.1,
  heroImage: 1.1,
  heroEyebrow: 0.7,
  heroLede: 0.8,
  heroCta: 0.65,
  sectionReveal: 0.9,
  cardReveal: 0.8,
  ambientLoop: 2.6,
  magnetic: 0.35,
  velocitySkew: 0.3,
} as const;

export const STAGGERS = {
  heroChar: 0.018,
  heroCta: 0.08,
  sectionReveal: 0.12,
  cardReveal: 0.08,
  communityTile: 0.12,
} as const;

export const DELAYS = {
  heroStart: 0.15,
  heroEyebrow: 0,
  heroChars: 0.08,
  heroLede: 0.34,
  heroCta: 0.42,
  heroImage: 0.18,
} as const;

export const TRANSFORMS = {
  heroCharYPercent: 110,
  heroCharRotate: 2,
  heroImageScale: 1.08,
  heroImageRotate: 0.8,
  heroImageY: 40,
  heroEyebrowY: 28,
  heroLedeY: 28,
  heroCtaY: 18,
  magneticXMax: 14,
  magneticYMax: 10,
  magneticRotateMax: 4,
  velocitySkewMax: 3.2,
  velocityTiltMax: 2.4,
  cardTiltMax: 8,
} as const;
