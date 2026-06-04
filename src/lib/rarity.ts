// Rarity = fame score, 1-100 (higher = more famous = fewer points).
// The spec's full algorithm (career production, all-star caps, Wikipedia
// pageviews) is a later monthly enrichment pass. For now we store a neutral
// baseline so the schema constraint (1-100) is satisfied and cells are
// playable; the enrichment job will overwrite these values.
export const DEFAULT_RARITY = 50

export function computeRarity(): number {
  return DEFAULT_RARITY
}
