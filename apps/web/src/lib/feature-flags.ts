/** Flags referenced by navigation and other app surfaces (values match FEATURE_FLAGS env tokens). */
export const PAGE_FEATURES = {
  ENABLE_PROFILES: 'enable_profiles',
} as const;

export type PageFeature = (typeof PAGE_FEATURES)[keyof typeof PAGE_FEATURES];

const activeFeatureFlags = parseFeatureFlags(process.env.FEATURE_FLAGS ?? '');

function parseFeatureFlags(raw: string): ReadonlySet<string> {
  if (!raw.trim()) return new Set();

  const flags = new Set<string>();
  for (const segment of raw.split(',')) {
    const key = segment.trim().toLowerCase();
    if (!key) continue;
    flags.add(key);
  }
  return flags;
}

export function getFeatureFlags(): ReadonlySet<string> {
  return activeFeatureFlags;
}

export function hasFeatureFlag(flag: string): boolean {
  return activeFeatureFlags.has(flag.toLowerCase());
}
