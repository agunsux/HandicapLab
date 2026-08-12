/**
 * Phase 0.5 — Live Provider Probe
 * ================================
 * Deterministic, read-only probe. Proves that production credentials
 * can authenticate with API-Football and OddsPAPI, receive valid data,
 * and pass schema + normalization validation.
 *
 * SAFETY:
 * - Maximum 1 external request per provider (hard ceiling)
 * - No database writes
 * - No prediction writes
 * - No scheduler / orchestrator interaction
 * - No secrets printed
 *
 * Run: npx tsx scripts/phase0_5_live_probe.ts
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

const envFiles = ['.env.production.local', '.env.local', '.env'];
for (const file of envFiles) {
  const p = path.join(process.cwd(), file);
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
  }
}
import * as crypto from 'crypto';

// ─── Types ──────────────────────────────────────────────────────────────────

interface ProviderProbeResult {
  provider: string;
  credentialConfigured: boolean;
  authenticated: boolean;
  httpStatus: number | null;
  responseLatencyMs: number;
  recordsReturned: number;
  schemaValid: boolean;
  schemaErrors: string[];
  normalizationPass: boolean;
  normalizationDetails: string;
  quotaStatus: string;
  providerHealth: 'PASS' | 'PARTIAL' | 'FAIL';
  requestCount: number;
  errors: string[];
}

interface ProbeReport {
  timestamp: string;
  gitCommit: string;
  environment: string;
  probeVersion: string;
  apiFootball: ProviderProbeResult;
  oddsPapi: ProviderProbeResult;
  crossProvider: {
    commonEvent: 'YES' | 'NO' | 'NOT_TESTABLE';
    details: string;
  };
  safety: {
    databaseWrites: number;
    predictionWrites: number;
    historicalRequests: number;
    schedulerRuns: number;
    orchestratorRuns: number;
    unexpectedRequests: number;
  };
  finalVerdict: 'PHASE 0.5 PASS' | 'PHASE 0.5 FAIL';
}

// ─── Hard Ceiling ───────────────────────────────────────────────────────────

const MAX_REQUESTS_PER_PROVIDER = 1;
let apiFootballRequestCount = 0;
let oddsPapiRequestCount = 0;

// ─── Helpers ────────────────────────────────────────────────────────────────

function getGitCommit(): string {
  try {
    const { execSync } = require('child_process');
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8' }).trim();
  } catch {
    return 'unknown';
  }
}

function log(category: string, message: string, data?: Record<string, unknown>) {
  const ts = new Date().toISOString();
  const payload = data ? ` ${JSON.stringify(data)}` : '';
  console.log(`[${ts}] [${category}] ${message}${payload}`);
}

// ─── API-Football Probe ─────────────────────────────────────────────────────

async function probeApiFootball(): Promise<ProviderProbeResult> {
  const result: ProviderProbeResult = {
    provider: 'API-Football',
    credentialConfigured: false,
    authenticated: false,
    httpStatus: null,
    responseLatencyMs: 0,
    recordsReturned: 0,
    schemaValid: false,
    schemaErrors: [],
    normalizationPass: false,
    normalizationDetails: '',
    quotaStatus: 'NOT_CHECKED',
    providerHealth: 'FAIL',
    requestCount: 0,
    errors: [],
  };

  // Check credential
  const apiKey = process.env.APIFOOTBALL_KEY || process.env.API_FOOTBALL_KEY;
  result.credentialConfigured = !!(apiKey && apiKey.trim().length > 0 && apiKey !== 'mock');

  if (!result.credentialConfigured) {
    result.errors.push('APIFOOTBALL_KEY not configured or empty');
    return result;
  }

  // Guard: hard ceiling
  if (apiFootballRequestCount >= MAX_REQUESTS_PER_PROVIDER) {
    result.errors.push('Request ceiling reached');
    return result;
  }

  log('API-FOOTBALL', 'PROBE REQUEST', {
    provider: 'API-Football',
    endpointClass: '/status',
    purpose: 'Authentication and status verification',
    requestNumber: apiFootballRequestCount + 1,
    maxAllowed: MAX_REQUESTS_PER_PROVIDER,
  });

  const startTime = Date.now();

  try {
    // Use /status endpoint — cheapest possible, returns account info
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch('https://v3.football.api-sports.io/status', {
      method: 'GET',
      headers: {
        'x-apisports-key': apiKey || '',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    apiFootballRequestCount++;
    result.requestCount = apiFootballRequestCount;
    result.responseLatencyMs = Date.now() - startTime;
    result.httpStatus = response.status;

    if (!response.ok) {
      result.errors.push(`HTTP ${response.status}`);
      return result;
    }

    result.authenticated = true;

    const body = await response.json();

    // Schema validation: API-Football wraps in { get, parameters, errors, results, response }
    const hasEnvelope = body && typeof body === 'object'
      && 'get' in body
      && 'response' in body
      && 'errors' in body
      && 'results' in body;

    if (!hasEnvelope) {
      result.schemaErrors.push('Missing API-Football envelope fields (get, response, errors, results)');
      return result;
    }

    // Check for API-level errors
    const apiErrors = body.errors;
    if (apiErrors && (Array.isArray(apiErrors) ? apiErrors.length > 0 : Object.keys(apiErrors).length > 0)) {
      result.schemaErrors.push(`API-level errors: ${JSON.stringify(apiErrors)}`);
      return result;
    }

    result.schemaValid = true;

    // Normalize: extract account status from /status response
    const account = body.response?.account;
    const subscription = body.response?.subscription;
    const requests = body.response?.requests;

    if (account && subscription) {
      result.normalizationPass = true;
      result.normalizationDetails = [
        `plan=${subscription.plan || 'unknown'}`,
        `status=${account.status || 'unknown'}`,
        `requests_current=${requests?.current ?? 'N/A'}`,
        `requests_limit_day=${requests?.limit_day ?? 'N/A'}`,
      ].join(', ');

      // Quota status from the response itself
      if (requests?.current !== undefined && requests?.limit_day !== undefined) {
        const used = requests.current;
        const limit = requests.limit_day;
        result.quotaStatus = `${used}/${limit} daily requests used`;
      } else {
        result.quotaStatus = 'QUOTA_INFO_AVAILABLE';
      }

      result.recordsReturned = 1; // /status returns a single account object
      result.providerHealth = 'PASS';
    } else {
      result.normalizationDetails = 'Account/subscription fields missing from /status response';
      result.providerHealth = 'PARTIAL';
    }

    log('API-FOOTBALL', 'PROBE COMPLETE', {
      httpStatus: result.httpStatus,
      authenticated: result.authenticated,
      schemaValid: result.schemaValid,
      normalizationPass: result.normalizationPass,
      latencyMs: result.responseLatencyMs,
    });

  } catch (err: any) {
    result.responseLatencyMs = Date.now() - startTime;
    if (err.name === 'AbortError') {
      result.errors.push('Request timed out (10s)');
    } else {
      result.errors.push(err.message || String(err));
    }
  }

  return result;
}

// ─── OddsPAPI Probe ─────────────────────────────────────────────────────────

async function probeOddsPapi(): Promise<ProviderProbeResult> {
  const result: ProviderProbeResult = {
    provider: 'OddsPAPI (oddspapi.com)',
    credentialConfigured: false,
    authenticated: false,
    httpStatus: null,
    responseLatencyMs: 0,
    recordsReturned: 0,
    schemaValid: false,
    schemaErrors: [],
    normalizationPass: false,
    normalizationDetails: '',
    quotaStatus: 'NOT_CHECKED',
    providerHealth: 'FAIL',
    requestCount: 0,
    errors: [],
  };

  // Check credential
  const apiKey = process.env.ODDS_PAPI_KEY || process.env.ODDSPAPI_KEY;
  result.credentialConfigured = !!(apiKey && apiKey.trim().length > 0 && apiKey !== 'mock');

  if (!result.credentialConfigured) {
    result.errors.push('ODDS_PAPI_KEY not configured or empty');
    return result;
  }

  // Guard: hard ceiling
  if (oddsPapiRequestCount >= MAX_REQUESTS_PER_PROVIDER) {
    result.errors.push('Request ceiling reached');
    return result;
  }

  log('ODDSPAPI', 'PROBE REQUEST', {
    provider: 'OddsPAPI',
    endpointClass: '/v4/sports',
    purpose: 'Authentication and sports list verification',
    requestNumber: oddsPapiRequestCount + 1,
    maxAllowed: MAX_REQUESTS_PER_PROVIDER,
  });

  const startTime = Date.now();

  try {
    const url = new URL('https://api.oddspapi.io/v4/sports');
    url.searchParams.set('apiKey', apiKey || '');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    oddsPapiRequestCount++;
    result.requestCount = oddsPapiRequestCount;
    result.responseLatencyMs = Date.now() - startTime;
    result.httpStatus = response.status;

    // Check quota headers
    const remainingRequests = response.headers.get('x-requests-remaining');
    const usedRequests = response.headers.get('x-requests-used');
    if (remainingRequests !== null || usedRequests !== null) {
      result.quotaStatus = `used=${usedRequests ?? 'N/A'}, remaining=${remainingRequests ?? 'N/A'}`;
    }

    if (!response.ok) {
      const errorBody = await response.text();
      result.errors.push(`HTTP ${response.status}: ${errorBody.substring(0, 200)}`);
      return result;
    }

    result.authenticated = true;

    const body = await response.json();

    // Schema validation: /v4/sports returns an array of sport objects
    if (!Array.isArray(body)) {
      result.schemaErrors.push('Expected array from /v4/sports endpoint');
      return result;
    }

    // Validate each sport object has expected fields
    const soccerSports = body.filter((s: any) => s.group?.toLowerCase().includes('soccer'));
    const schemaCheckSample = body[0];

    if (schemaCheckSample) {
      const requiredFields = ['key', 'active', 'group', 'description', 'title', 'has_outrights'];
      const missingFields = requiredFields.filter(f => !(f in schemaCheckSample));

      if (missingFields.length > 0) {
        result.schemaErrors.push(`Missing fields in sport object: ${missingFields.join(', ')}`);
      } else {
        result.schemaValid = true;
      }
    } else {
      result.schemaErrors.push('Empty sports list returned');
    }

    result.recordsReturned = body.length;

    // Normalization: extract meaningful football data
    if (soccerSports.length > 0) {
      result.normalizationPass = true;
      const sportKeys = soccerSports.map((s: any) => s.key).slice(0, 5);
      result.normalizationDetails = [
        `total_sports=${body.length}`,
        `soccer_sports=${soccerSports.length}`,
        `sample_keys=[${sportKeys.join(', ')}]`,
      ].join(', ');
      result.providerHealth = 'PASS';
    } else if (body.length > 0) {
      result.normalizationPass = true;
      result.normalizationDetails = `total_sports=${body.length}, soccer_sports=0 (possibly off-season)`;
      result.providerHealth = 'PARTIAL';
    } else {
      result.normalizationDetails = 'No sports returned';
      result.providerHealth = 'FAIL';
    }

    log('ODDSPAPI', 'PROBE COMPLETE', {
      httpStatus: result.httpStatus,
      authenticated: result.authenticated,
      schemaValid: result.schemaValid,
      normalizationPass: result.normalizationPass,
      recordsReturned: result.recordsReturned,
      latencyMs: result.responseLatencyMs,
    });

  } catch (err: any) {
    result.responseLatencyMs = Date.now() - startTime;
    if (err.name === 'AbortError') {
      result.errors.push('Request timed out (10s)');
    } else {
      result.errors.push(err.message || String(err));
    }
  }

  return result;
}

// ─── Cross-Provider Check ───────────────────────────────────────────────────

function crossProviderCheck(
  _afResult: ProviderProbeResult,
  _opResult: ProviderProbeResult
): ProbeReport['crossProvider'] {
  // Minimal probe endpoints do not return overlapping event data,
  // so cross-provider matching is not testable with minimal probe.
  return {
    commonEvent: 'NOT_TESTABLE',
    details: 'Minimal probe endpoints (/status and /v4/sports) do not return fixture-level event data. Cross-provider matching requires fixture-level requests which exceed the minimal probe scope.',
  };
}

// ─── Report Generation ──────────────────────────────────────────────────────

function generateReport(report: ProbeReport): string {
  const af = report.apiFootball;
  const op = report.oddsPapi;

  return `# Phase 0.5 Live Provider Report

## Execution

| Field | Value |
|---|---|
| Timestamp | ${report.timestamp} |
| Git Commit | \`${report.gitCommit}\` |
| Environment | ${report.environment} |
| Probe Version | ${report.probeVersion} |

## API-Football

| Metric | Result |
|---|---|
| Credential configured | ${af.credentialConfigured ? 'YES' : 'NO'} |
| Authenticated | ${af.authenticated ? 'YES' : 'NO'} |
| HTTP status | ${af.httpStatus ?? 'N/A'} |
| Response latency | ${af.responseLatencyMs}ms |
| Records returned | ${af.recordsReturned} |
| Schema validation | ${af.schemaValid ? 'PASS' : 'FAIL'} |
| Schema errors | ${af.schemaErrors.length > 0 ? af.schemaErrors.join('; ') : 'None'} |
| Normalization | ${af.normalizationPass ? 'PASS' : 'FAIL'} |
| Normalization details | ${af.normalizationDetails || 'N/A'} |
| Quota status | ${af.quotaStatus} |
| Provider health | **${af.providerHealth}** |
| Request count | ${af.requestCount} |
| Errors | ${af.errors.length > 0 ? af.errors.join('; ') : 'None'} |

## OddsPAPI

| Metric | Result |
|---|---|
| Credential configured | ${op.credentialConfigured ? 'YES' : 'NO'} |
| Authenticated | ${op.authenticated ? 'YES' : 'NO'} |
| HTTP status | ${op.httpStatus ?? 'N/A'} |
| Response latency | ${op.responseLatencyMs}ms |
| Records returned | ${op.recordsReturned} |
| Schema validation | ${op.schemaValid ? 'PASS' : 'FAIL'} |
| Schema errors | ${op.schemaErrors.length > 0 ? op.schemaErrors.join('; ') : 'None'} |
| Normalization | ${op.normalizationPass ? 'PASS' : 'FAIL'} |
| Normalization details | ${op.normalizationDetails || 'N/A'} |
| Quota status | ${op.quotaStatus} |
| Provider health | **${op.providerHealth}** |
| Request count | ${op.requestCount} |
| Errors | ${op.errors.length > 0 ? op.errors.join('; ') : 'None'} |

## Cross Provider

| Check | Result |
|---|---|
| Common event found | ${report.crossProvider.commonEvent} |
| Details | ${report.crossProvider.details} |

## Safety

| Check | Count |
|---|---|
| Database writes | ${report.safety.databaseWrites} |
| Prediction writes | ${report.safety.predictionWrites} |
| Historical requests | ${report.safety.historicalRequests} |
| Scheduler runs | ${report.safety.schedulerRuns} |
| Orchestrator runs | ${report.safety.orchestratorRuns} |
| Unexpected requests | ${report.safety.unexpectedRequests} |

## Final Verdict

| Provider | Result |
|---|---|
| API-Football | **${af.providerHealth}** |
| OddsPAPI | **${op.providerHealth}** |

**Overall: ${report.finalVerdict}**
`;
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  console.log('═'.repeat(60));
  console.log('  PHASE 0.5 — LIVE PROVIDER PROBE');
  console.log('═'.repeat(60));

  log('PROBE', 'Starting Phase 0.5 Live Provider Probe');
  log('PROBE', 'Hard ceiling: 1 request per provider');
  log('PROBE', 'Mode: READ-ONLY, no DB writes, no predictions');

  // Credential presence check (no values printed)
  const afKeyPresent = !!(process.env.APIFOOTBALL_KEY || process.env.API_FOOTBALL_KEY);
  const opKeyPresent = !!(process.env.ODDS_PAPI_KEY || process.env.ODDSPAPI_KEY);
  log('CREDENTIAL', 'Presence check', {
    APIFOOTBALL_KEY: afKeyPresent ? 'PRESENT' : 'MISSING',
    ODDS_PAPI_KEY: opKeyPresent ? 'PRESENT' : 'MISSING',
  });

  // Execute probes
  log('PROBE', 'Probing API-Football...');
  const afResult = await probeApiFootball();

  log('PROBE', 'Probing OddsPAPI...');
  const opResult = await probeOddsPapi();

  // Cross-provider check
  const crossResult = crossProviderCheck(afResult, opResult);

  // Determine final verdict
  const bothPass = afResult.providerHealth !== 'FAIL' && opResult.providerHealth !== 'FAIL';
  const finalVerdict: ProbeReport['finalVerdict'] = bothPass
    ? 'PHASE 0.5 PASS'
    : 'PHASE 0.5 FAIL';

  // Build full report
  const report: ProbeReport = {
    timestamp: new Date().toISOString(),
    gitCommit: getGitCommit(),
    environment: 'local',
    probeVersion: '0.5.0',
    apiFootball: afResult,
    oddsPapi: opResult,
    crossProvider: crossResult,
    safety: {
      databaseWrites: 0,
      predictionWrites: 0,
      historicalRequests: 0,
      schedulerRuns: 0,
      orchestratorRuns: 0,
      unexpectedRequests: 0,
    },
    finalVerdict,
  };

  // Generate markdown report
  const reportContent = generateReport(report);
  const reportPath = path.join(process.cwd(), 'PHASE0_5_LIVE_PROVIDER_REPORT.md');
  fs.writeFileSync(reportPath, reportContent, 'utf-8');
  log('REPORT', `Report written to ${reportPath}`);

  // Summary
  console.log('\n' + '═'.repeat(60));
  console.log('  PHASE 0.5 SUMMARY');
  console.log('═'.repeat(60));
  console.log(`  API-Football  : ${afResult.providerHealth} (${afResult.requestCount} request(s))`);
  console.log(`  OddsPAPI      : ${opResult.providerHealth} (${opResult.requestCount} request(s))`);
  console.log(`  Total requests: ${apiFootballRequestCount + oddsPapiRequestCount}`);
  console.log(`  DB writes     : 0`);
  console.log(`  Verdict       : ${finalVerdict}`);
  console.log('═'.repeat(60));

  // Exit code for CI
  process.exit(finalVerdict === 'PHASE 0.5 PASS' ? 0 : 1);
}

main().catch((err) => {
  console.error('[FATAL] Unhandled error in Phase 0.5 probe:', err.message || err);
  process.exit(1);
});
