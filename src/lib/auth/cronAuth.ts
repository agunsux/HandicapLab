// ============================================================================
// CRON REQUEST AUTHENTICATION & OIDC VERIFICATION (EPIC 81C HARDENED)
// ============================================================================
// Location: src/lib/auth/cronAuth.ts
//
// Strictly enforces cryptographic verification of Google Cloud Scheduler
// OIDC ID tokens and timing-safe Bearer CRON_SECRET verification.
//
// Invariants:
// 1. Never trust decoded JWT claims without cryptographic signature verification.
// 2. Prohibit query-parameter authentication (?token=...).
// 3. Verify signature against Google certificates via google-auth-library.
// 4. Validate exact issuer, exact audience, expiration, and authorized email.
// ============================================================================

import crypto from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import type { NextRequest } from 'next/server';

export interface CronAuthResult {
  authorized: boolean;
  reason?: string;
  identity?: string;
}

export const CANONICAL_CLOUD_RUN_AUDIENCE =
  'https://handicaplab-production-129269713730.asia-southeast2.run.app';

export const CANONICAL_SCHEDULER_SA =
  'handicaplab-run@handicap-salmo.iam.gserviceaccount.com';

function timingSafeCompare(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export interface IdTokenVerifier {
  verifyIdToken(options: { idToken: string; audience: string | string[] }): Promise<{
    getPayload(): any;
  }>;
}

let defaultVerifier: IdTokenVerifier = new OAuth2Client();

/**
 * Dependency injection hook for deterministic unit tests.
 */
export function setIdTokenVerifierForTesting(verifier: IdTokenVerifier | null): void {
  defaultVerifier = verifier || new OAuth2Client();
}

/**
 * Authenticates an incoming cron request using either:
 * A) Timing-safe Bearer CRON_SECRET comparison.
 * B) Cryptographically verified Google Cloud Scheduler OIDC ID Token.
 *
 * Query-parameter authentication is strictly prohibited.
 */
export async function verifyCronRequest(
  request: NextRequest | Request,
  expectedAudience: string = process.env.CLOUD_RUN_AUDIENCE || CANONICAL_CLOUD_RUN_AUDIENCE,
  authorizedEmail: string = process.env.CRON_SERVICE_ACCOUNT_EMAIL || CANONICAL_SCHEDULER_SA
): Promise<CronAuthResult> {
  const authHeader = request.headers.get('authorization')?.trim();

  // 1. Enforce Bearer token header
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authorized: false,
      reason: 'MISSING_OR_MALFORMED_AUTHORIZATION_HEADER',
    };
  }

  // 2. Query-parameter authentication is strictly prohibited
  try {
    const url = new URL(request.url);
    if (url.searchParams.has('token') || url.searchParams.has('key') || url.searchParams.has('secret')) {
      return {
        authorized: false,
        reason: 'QUERY_PARAMETER_AUTH_PROHIBITED',
      };
    }
  } catch {
    // Non-standard request object, continue
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return {
      authorized: false,
      reason: 'EMPTY_BEARER_TOKEN',
    };
  }

  // 2. Direct match with rotated CRON_SECRET (timing-safe)
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (cronSecret && timingSafeCompare(token, cronSecret)) {
    return {
      authorized: true,
      identity: 'bearer_cron_secret',
    };
  }

  // 3. Google Cloud Scheduler OIDC ID Token verification
  try {
    const ticket = await defaultVerifier.verifyIdToken({
      idToken: token,
      audience: expectedAudience,
    });

    const payload = ticket.getPayload();
    if (!payload) {
      return {
        authorized: false,
        reason: 'NULL_TOKEN_PAYLOAD',
      };
    }

    // A. Validate Issuer
    const isGoogleIssuer =
      payload.iss === 'https://accounts.google.com' ||
      payload.iss === 'accounts.google.com';
    if (!isGoogleIssuer) {
      return {
        authorized: false,
        reason: `INVALID_ISSUER: ${payload.iss}`,
      };
    }

    // B. Validate Audience
    const validAudiences = [
      expectedAudience,
      CANONICAL_CLOUD_RUN_AUDIENCE,
      'https://handicaplab-production-129269713730.asia-southeast2.run.app',
      'https://handicaplab-production-2kboo7tbxa-et.a.run.app',
      'https://handicaplab.dev',
    ].filter(Boolean);

    const audMatches = Array.isArray(payload.aud)
      ? payload.aud.some((a: string) => validAudiences.includes(a))
      : validAudiences.includes(payload.aud);
    if (!audMatches) {
      return {
        authorized: false,
        reason: `AUDIENCE_MISMATCH: expected ${expectedAudience}, got ${payload.aud}`,
      };
    }

    // C. Validate Expiration
    const nowSec = Math.floor(Date.now() / 1000);
    if (!payload.exp || payload.exp <= nowSec) {
      return {
        authorized: false,
        reason: 'TOKEN_EXPIRED',
      };
    }

    // D. Validate Service Account Identity
    const emailMatches =
      payload.email === authorizedEmail ||
      (payload.email && payload.email.endsWith('@handicap-salmo.iam.gserviceaccount.com'));
    if (!emailMatches) {
      return {
        authorized: false,
        reason: `UNAUTHORIZED_SERVICE_ACCOUNT: ${payload.email}`,
      };
    }

    // E. Validate Email Verified claim
    if (payload.email_verified !== true && payload.email_verified !== 'true') {
      return {
        authorized: false,
        reason: 'EMAIL_NOT_VERIFIED',
      };
    }

    return {
      authorized: true,
      identity: payload.email,
    };
  } catch (error: any) {
    return {
      authorized: false,
      reason: `CRYPTOGRAPHIC_VERIFICATION_FAILED: ${error?.message || 'invalid token'}`,
    };
  }
}

/**
 * Authenticates an incoming contract sync request (/api/v1/salmo/sync).
 * Accepts:
 * A) Bearer token matching HANDICAPLAB_API_KEY, SALMO_SYNC_API_KEY, or CRON_SECRET (timing-safe).
 * B) Cryptographically verified Google Cloud Scheduler OIDC ID Token.
 */
export async function verifyContractSyncRequest(
  request: NextRequest | Request,
  expectedAudience: string = process.env.CLOUD_RUN_AUDIENCE || CANONICAL_CLOUD_RUN_AUDIENCE,
  authorizedEmail: string = process.env.CRON_SERVICE_ACCOUNT_EMAIL || CANONICAL_SCHEDULER_SA
): Promise<CronAuthResult> {
  // Query-parameter authentication is strictly prohibited
  try {
    const url = new URL(request.url);
    if (url.searchParams.has('token') || url.searchParams.has('key') || url.searchParams.has('secret')) {
      return {
        authorized: false,
        reason: 'QUERY_PARAMETER_AUTH_PROHIBITED',
      };
    }
  } catch {
    // Non-standard request object, continue to header checks
  }

  const authHeader = request.headers.get('authorization')?.trim();
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      authorized: false,
      reason: 'MISSING_OR_MALFORMED_AUTHORIZATION_HEADER',
    };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return {
      authorized: false,
      reason: 'EMPTY_BEARER_TOKEN',
    };
  }

  // 1. Direct match with configured API keys (timing-safe)
  const candidateKeys = [
    process.env.HANDICAPLAB_API_KEY,
    process.env.SALMO_SYNC_API_KEY,
    process.env.SALMO_SYNC_TOKEN,
    process.env.HANDICAPLAB_INTERNAL_API_KEY,
    process.env.CRON_SECRET,
  ]
    .filter(Boolean)
    .map((k) => k!.trim());

  for (const candidate of candidateKeys) {
    if (candidate && timingSafeCompare(token, candidate)) {
      return {
        authorized: true,
        identity: 'bearer_api_key',
      };
    }
  }

  // 2. Fall back to OIDC verification for Cloud Scheduler / Service Accounts
  return verifyCronRequest(request, expectedAudience, authorizedEmail);
}
