// Canonical Request Identity
// Location: src/lib/providers/requestIdentity.ts
//
// A single canonical, secret-free identity for a provider request. Used by the
// Provider Gateway for cache keys, in-flight deduplication and audit
// fingerprints. Query parameter ORDER must never change identity, and no
// credential may ever appear in the identity or fingerprint.

/** Params that must never contribute to (or leak through) a request identity. */
const SENSITIVE_PARAM_NAMES = new Set([
  'apikey',
  'api_key',
  'key',
  'token',
  'access_token',
  'auth',
  'authorization',
  'secret',
  'x-apisports-key',
]);

/** Volatile params that would defeat caching / dedup. */
const VOLATILE_PARAM_NAMES = new Set(['_ts', 'timestamp', 'cachebuster', 'nocache']);

/**
 * Returns a canonical URL string: scheme+host+path lowercase, query params
 * sorted deterministically, sensitive/volatile params removed. Two logically
 * identical requests (differing only in query order) resolve to the same value.
 */
export function canonicalizeUrl(rawUrl: string): string {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    // Not an absolute URL: fall back to trimming whitespace.
    return rawUrl.trim();
  }

  const entries: Array<[string, string]> = [];
  parsed.searchParams.forEach((value, name) => {
    const lower = name.toLowerCase();
    if (SENSITIVE_PARAM_NAMES.has(lower) || VOLATILE_PARAM_NAMES.has(lower)) return;
    entries.push([name, value]);
  });
  entries.sort((a, b) => (a[0] === b[0] ? a[1].localeCompare(b[1]) : a[0].localeCompare(b[0])));

  const search = entries.length
    ? '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
    : '';

  const path = parsed.pathname.replace(/\/+$/, '') || '/';
  return `${parsed.protocol}//${parsed.host.toLowerCase()}${path}${search}`;
}

export interface RequestIdentityInput {
  provider: string;
  endpoint: string;
  method?: string;
  url: string;
  body?: string | null;
}

/**
 * Canonical cache/dedup key. Format is stable and intentionally readable for
 * debugging; it contains no credentials.
 */
export function canonicalRequestKey(input: RequestIdentityInput): string {
  const method = (input.method || 'GET').toUpperCase();
  const canonicalUrl = canonicalizeUrl(input.url);
  const body = input.body || '';
  return `${input.provider}:${input.endpoint}:${method}:${canonicalUrl}:${body}`;
}

/** FNV-1a 32-bit hash (pure JS, edge/serverless safe). Not cryptographic. */
function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

/**
 * Short, secret-free audit fingerprint for a request. Safe to log and persist.
 */
export function requestFingerprint(input: RequestIdentityInput): string {
  return fnv1a(canonicalRequestKey(input));
}
