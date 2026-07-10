/**
 * HandicapLab Semantic Version Utilities
 * ==============================================
 * Lightweight semver type and helpers for registry versioning.
 *
 * Uses the standard major.minor.patch format throughout.
 */

export interface SemVer {
  major: number;
  minor: number;
  patch: number;
}

/**
 * Parse a version string into its numeric components.
 * Missing parts default to 0.
 */
export function parseSemver(version: string): SemVer {
  const parts = version.split('.');
  return {
    major: parseInt(parts[0] || '0', 10),
    minor: parseInt(parts[1] || '0', 10),
    patch: parseInt(parts[2] || '0', 10),
  };
}

/**
 * Format a SemVer struct back into a dotted string.
 */
export function formatSemver(sv: SemVer): string {
  return sv.major + '.' + sv.minor + '.' + sv.patch;
}

/** Increment the major version and reset minor & patch to 0. */
export function incrementMajor(v: string): string { const s = parseSemver(v); s.major++; s.minor = 0; s.patch = 0; return formatSemver(s); }
/** Increment the minor version and reset patch to 0. */
export function incrementMinor(v: string): string { const s = parseSemver(v); s.minor++; s.patch = 0; return formatSemver(s); }
/** Increment the patch version. */
export function incrementPatch(v: string): string { const s = parseSemver(v); s.patch++; return formatSemver(s); }

/** Compare two version strings. Returns -1 / 0 / 1. */
export function compareSemver(a: string, b: string): number {
  const sa = parseSemver(a), sb = parseSemver(b);
  if (sa.major !== sb.major) return sa.major - sb.major;
  if (sa.minor !== sb.minor) return sa.minor - sb.minor;
  if (sa.patch !== sb.patch) return sa.patch - sb.patch;
  return 0;
}
