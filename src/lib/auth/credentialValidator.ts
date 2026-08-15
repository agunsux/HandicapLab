const TRANSCRIPT_MARKERS = [
  'Searched for',
  'Viewed ',
  'Ran command',
  'Created ',
  'Bearer Searched',
  '.ts',
  'Searching for',
  'Found ',
  'Reading ',
  'Writing ',
  'Edited ',
  'Tool Use',
  'task_progress',
  'analyzing',
  'Search',
  'file://',
];

export type CredentialKind = 'opaque' | 'jwt';

/**
 * Fail-closed credential validation.
 *
 * Throws on: missing, empty, whitespace/newline contamination, transcript
 * markers, placeholder/dummy values, malformed structure, or suspiciously
 * short values. Returns the trimmed value on success. Never returns a
 * substitute/fabricated credential.
 */
export function validateCredential(
  keyName: string,
  value: string | undefined,
  kind: CredentialKind = 'opaque'
): string {
  if (!value) {
    throw new Error(`[FAIL CLOSED] Authentication failed: Missing credential for ${keyName}`);
  }

  const v = value.trim();

  if (v.length === 0) {
    throw new Error(`[FAIL CLOSED] Authentication failed: Empty credential for ${keyName}`);
  }

  // Whitespace check (also catches newline-corrupted / multi-line contamination)
  if (/\s/.test(v)) {
    throw new Error(`[FAIL CLOSED] Authentication failed: Credential for ${keyName} contains whitespace. This is indicative of contamination.`);
  }

  // Control characters are never part of a legitimate credential
  if (/[\u0000-\u001f\u007f]/.test(v)) {
    throw new Error(`[FAIL CLOSED] Authentication failed: Credential for ${keyName} contains control characters.`);
  }

  // Transcript marker check
  const lower = v.toLowerCase();
  for (const marker of TRANSCRIPT_MARKERS) {
    if (lower.includes(marker.toLowerCase())) {
      throw new Error(`[FAIL CLOSED] Authentication failed: Credential for ${keyName} contains transcript contamination marker.`);
    }
  }

  // Placeholder check
  if (lower.includes('your_') || lower === 'xxxx' || lower.includes('placeholder') || lower.includes('changeme') || lower.includes('mock')) {
    throw new Error(`[FAIL CLOSED] Authentication failed: Credential for ${keyName} is a dummy/placeholder value.`);
  }

  // Length check (arbitrary minimum for typical API keys and JWTs)
  if (v.length < 16) {
    throw new Error(`[FAIL CLOSED] Authentication failed: Credential for ${keyName} is suspiciously short (${v.length} chars).`);
  }

  if (kind === 'jwt') {
    // Structural JWT check: exactly 3 dot-separated base64url segments.
    const parts = v.split('.');
    if (parts.length !== 3) {
      throw new Error(`[FAIL CLOSED] Authentication failed: Credential for ${keyName} is malformed (expected a 3-segment JWT).`);
    }
    for (const p of parts) {
      if (p.length < 10 || !/^[A-Za-z0-9_-]+$/.test(p)) {
        throw new Error(`[FAIL CLOSED] Authentication failed: Credential for ${keyName} is malformed (invalid JWT segment).`);
      }
    }
  } else {
    // Opaque keys must be URL-safe-ish; anything outside this set is malformed.
    if (!/^[A-Za-z0-9._~/+-]+$/.test(v)) {
      throw new Error(`[FAIL CLOSED] Authentication failed: Credential for ${keyName} is malformed (unsupported characters).`);
    }
  }

  return v;
}
