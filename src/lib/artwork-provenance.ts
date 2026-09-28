export const ARTWORK_PROVENANCE_OPTIONS = [
  { value: "unspecified", label: "Unspecified" },
  { value: "human_created", label: "Human-created artwork (creator confirmed)" },
  { value: "ai_assisted_or_generated", label: "AI-assisted or generated artwork" },
] as const;

export type ArtworkProvenance = (typeof ARTWORK_PROVENANCE_OPTIONS)[number]["value"];

export const ARTWORK_PROVENANCE_COPY = {
  fieldLabel: "Artwork provenance",
  badge: "Human-created artwork",
  explanation:
    "The creator has confirmed that this book’s illustrations and cover were made without generative AI.",
  adminHelp:
    "Choose human-created only after the creator confirms that the illustrations and cover were made without generative AI. Unspecified makes no claim about how the artwork was made.",
  catalogHeading: "About this library",
  catalogNonEndorsement:
    "Inclusion in this library does not imply a creator’s endorsement of other books or their production methods.",
} as const;

export function isArtworkProvenance(value: unknown): value is ArtworkProvenance {
  return value === "unspecified" || value === "human_created" || value === "ai_assisted_or_generated";
}
