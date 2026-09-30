/**
 * DRIBBLE360 CAPABILITY DISCOVERY — Stage A
 * 
 * Budget: ≤200 calls
 * Purpose: Systematically discover all available endpoints, parameters, and data shapes.
 * 
 * SECURITY: Never log API keys. All raw responses stored in gitignored location.
 * PROVENANCE: Every call logged with timestamp, endpoint, status, latency.
 */

import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

// Load environment variables from .env.local (has DRIBBLE_API_KEY)
dotenv.config({ path: path.resolve(__dirname, '..', '.env.local') });
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// ============================================================================
// CONFIGURATION
// ============================================================================
const BASE_URL = 'https://dribble360.com/api/v1';
const API_KEY = process.env.DRIBBLE_API_KEY?.trim();
const MAX_CALLS = 200;
const OUTPUT_DIR = path.resolve('data/research/dribble360');
const AUDIT_LOG = path.join(OUTPUT_DIR, 'capability_discovery_log.jsonl');
const RAW_DIR = path.join(OUTPUT_DIR, 'raw_captures');
const SCHEMA_DIR = path.join(OUTPUT_DIR, 'schemas');

// ============================================================================
// TYPES
// ============================================================================
interface CallRecord {
  timestamp: string;
  callNumber: number;
  endpoint: string;
  params: Record<string, string | number>;
  httpStatus: number;
  latencyMs: number;
  bytesReceived: number;
  recordsReturned: number;
  cacheHit: boolean;
  retryCount: number;
  purpose: string;
  errorClass: string | null;
  responseHash: string;
  paginationInfo: any;
  rateLimitHeaders: Record<string, string>;
}

interface CapabilityEntry {
  capability: string;
  exists: boolean;
  endpoint: string;
  parameters: string;
  cost: string;
  usefulFor: string;
  evidence: string;
  sampleFields?: string[];
  recordCount?: number;
  statusCode?: number;
}

// ============================================================================
// STATE
// ============================================================================
let callCount = 0;
const capabilities: CapabilityEntry[] = [];
const callLog: CallRecord[] = [];
const schemaRegistry: Record<string, any> = {};

// ============================================================================
// UTILITIES
// ============================================================================
function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function hashPayload(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex').slice(0, 16);
}

function extractSchema(obj: any, depth = 0, maxDepth = 3): any {
  if (depth > maxDepth) return '...';
  if (obj === null) return 'null';
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    return [extractSchema(obj[0], depth + 1, maxDepth)];
  }
  if (typeof obj === 'object') {
    const schema: Record<string, any> = {};
    for (const [key, val] of Object.entries(obj)) {
      schema[key] = typeof val === 'object' ? extractSchema(val, depth + 1, maxDepth) : typeof val;
    }
    return schema;
  }
  return typeof obj;
}

// ============================================================================
// API CALLER
// ============================================================================
async function dribbleCall(
  endpoint: string,
  params: Record<string, string | number> = {},
  purpose: string
): Promise<{ status: number; data: any; latencyMs: number; headers: Record<string, string>; raw: string }> {
  if (callCount >= MAX_CALLS) {
    console.log(`[QUOTA] Call limit reached (${MAX_CALLS}). Skipping: ${endpoint}`);
    return { status: -1, data: null, latencyMs: 0, headers: {}, raw: '' };
  }

  callCount++;
  const url = new URL(`${BASE_URL}${endpoint}`);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) url.searchParams.append(k, String(v));
  }

  const start = Date.now();
  let retryCount = 0;
  let lastError: any = null;
  
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Accept': 'application/json',
          'User-Agent': 'HandicapLab-Discovery/1.0',
        },
        signal: AbortSignal.timeout(30000),
      });
      
      const latencyMs = Date.now() - start;
      const raw = await res.text();
      
      const responseHeaders: Record<string, string> = {};
      res.headers.forEach((val, key) => {
        responseHeaders[key.toLowerCase()] = val;
      });

      let data: any = null;
      try { data = JSON.parse(raw); } catch { data = raw; }

      const recordsReturned = Array.isArray(data?.rows) ? data.rows.length 
        : Array.isArray(data?.data) ? data.data.length 
        : Array.isArray(data) ? data.length 
        : typeof data === 'object' && data ? 1 : 0;

      const record: CallRecord = {
        timestamp: new Date().toISOString(),
        callNumber: callCount,
        endpoint,
        params,
        httpStatus: res.status,
        latencyMs,
        bytesReceived: raw.length,
        recordsReturned,
        cacheHit: false,
        retryCount,
        purpose,
        errorClass: res.ok ? null : `HTTP_${res.status}`,
        responseHash: hashPayload(raw),
        paginationInfo: data?.pagination || data?.meta?.pagination || null,
        rateLimitHeaders: {
          limit: responseHeaders['x-ratelimit-limit'] || '',
          remaining: responseHeaders['x-ratelimit-remaining'] || '',
          reset: responseHeaders['x-ratelimit-reset'] || '',
        },
      };
      callLog.push(record);
      
      // Append to JSONL audit log
      fs.appendFileSync(AUDIT_LOG, JSON.stringify(record) + '\n');

      // Save raw capture (gitignored)
      const captureFile = path.join(
        RAW_DIR,
        `${endpoint.replace(/\//g, '_').replace(/^_/, '')}_${hashPayload(JSON.stringify(params))}.json`
      );
      fs.writeFileSync(captureFile, JSON.stringify({
        captured_at: new Date().toISOString(),
        endpoint,
        params,
        status: res.status,
        latencyMs,
        response_hash: hashPayload(raw),
        data,
      }, null, 2));

      return { status: res.status, data, latencyMs, headers: responseHeaders, raw };
    } catch (err: any) {
      lastError = err;
      retryCount++;
      if (attempt < 2) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  const failRecord: CallRecord = {
    timestamp: new Date().toISOString(),
    callNumber: callCount,
    endpoint,
    params,
    httpStatus: 0,
    latencyMs: Date.now() - start,
    bytesReceived: 0,
    recordsReturned: 0,
    cacheHit: false,
    retryCount,
    purpose,
    errorClass: lastError?.name || 'NETWORK_ERROR',
    responseHash: '',
    paginationInfo: null,
    rateLimitHeaders: {},
  };
  callLog.push(failRecord);
  fs.appendFileSync(AUDIT_LOG, JSON.stringify(failRecord) + '\n');

  return { status: 0, data: null, latencyMs: Date.now() - start, headers: {}, raw: '' };
}

// ============================================================================
// DISCOVERY FUNCTIONS
// ============================================================================

function addCapability(entry: CapabilityEntry) {
  capabilities.push(entry);
  console.log(`  [${entry.exists ? '✓' : '✗'}] ${entry.capability}: ${entry.evidence}`);
}

async function discoverEndpoint(
  name: string,
  endpoint: string,
  params: Record<string, string | number>,
  usefulFor: string
): Promise<any> {
  console.log(`\n--- Discovering: ${name} (${endpoint}) ---`);
  const result = await dribbleCall(endpoint, params, `Capability discovery: ${name}`);
  
  if (result.status === -1) {
    addCapability({
      capability: name,
      exists: false,
      endpoint,
      parameters: JSON.stringify(params),
      cost: 'SKIPPED (quota)',
      usefulFor,
      evidence: 'Call budget exhausted',
    });
    return null;
  }

  const exists = result.status >= 200 && result.status < 300;
  const dataArray = result.data?.rows || result.data?.data || (Array.isArray(result.data) ? result.data : null);
  const recordCount = Array.isArray(dataArray) ? dataArray.length : 0;
  
  let sampleFields: string[] = [];
  if (exists && dataArray && dataArray.length > 0) {
    sampleFields = Object.keys(dataArray[0]);
    schemaRegistry[endpoint] = {
      endpoint,
      params,
      recordCount,
      fields: sampleFields,
      schema: extractSchema(dataArray[0]),
      sampleRecord: dataArray[0],
      pagination: result.data?.pagination || result.data?.meta?.pagination || null,
    };
  }

  addCapability({
    capability: name,
    exists,
    endpoint,
    parameters: JSON.stringify(params),
    cost: '1 call',
    usefulFor,
    evidence: exists 
      ? `HTTP ${result.status}, ${recordCount} records, ${result.latencyMs}ms, fields: ${sampleFields.slice(0, 10).join(', ')}${sampleFields.length > 10 ? '...' : ''}`
      : `HTTP ${result.status}: ${result.data?.error || result.data?.message || 'Not found'}`,
    sampleFields,
    recordCount,
    statusCode: result.status,
  });

  return exists ? result.data : null;
}

// ============================================================================
// ODDS-SPECIFIC DISCOVERY
// ============================================================================
async function discoverOdds(): Promise<boolean> {
  console.log('\n========== G1: ODDS CAPABILITY DISCOVERY ==========');
  
  const oddsEndpoints: Array<{ name: string; endpoint: string; params: Record<string, string | number> }> = [
    { name: 'Odds (dedicated)', endpoint: '/odds', params: {} },
    { name: 'Fixture Odds', endpoint: '/fixtures/odds', params: {} },
    { name: 'Bookmakers', endpoint: '/bookmakers', params: {} },
    { name: 'Markets', endpoint: '/markets', params: {} },
    { name: 'Closing Odds', endpoint: '/closing-odds', params: {} },
    { name: 'Odds by Match', endpoint: '/odds', params: { season: '2025/2026' } },
    { name: 'Prematch Odds', endpoint: '/prematch-odds', params: {} },
    { name: 'Match Odds', endpoint: '/match_odds', params: {} },
  ];

  let hasOdds = false;
  for (const ep of oddsEndpoints) {
    const result = await dribbleCall(ep.endpoint, ep.params, `G1 odds discovery: ${ep.name}`);
    const exists = result.status >= 200 && result.status < 300;
    
    if (exists) {
      const dataArray = result.data?.rows || result.data?.data || (Array.isArray(result.data) ? result.data : null);
      if (dataArray && dataArray.length > 0) {
        const fields = Object.keys(dataArray[0]);
        const oddsFields = fields.filter(f => 
          /odds|price|line|handicap|spread|over|under|btts|bookmaker|pinnacle|sbobet|bet365/i.test(f)
        );
        if (oddsFields.length > 0) {
          hasOdds = true;
          console.log(`  [ODDS FOUND] ${ep.endpoint}: ${oddsFields.join(', ')}`);
        }
      }
    }
    
    addCapability({
      capability: `Odds: ${ep.name}`,
      exists,
      endpoint: ep.endpoint,
      parameters: JSON.stringify(ep.params),
      cost: '1 call',
      usefulFor: 'AH/OU/BTTS odds',
      evidence: exists 
        ? `HTTP ${result.status}` 
        : `HTTP ${result.status}: ${result.data?.error || result.data?.message || 'Not available'}`,
      statusCode: result.status,
    });
  }

  return hasOdds;
}

// ============================================================================
// MAIN DISCOVERY PIPELINE
// ============================================================================
async function main() {
  if (!API_KEY || API_KEY.length < 5) {
    console.error('[FATAL] DRIBBLE_API_KEY is not configured.');
    process.exit(1);
  }

  console.log('=========================================');
  console.log('DRIBBLE360 CAPABILITY DISCOVERY — Stage A');
  console.log(`Budget: ${MAX_CALLS} calls`);
  console.log(`Time: ${new Date().toISOString()}`);
  console.log('=========================================');

  ensureDir(OUTPUT_DIR);
  ensureDir(RAW_DIR);
  ensureDir(SCHEMA_DIR);

  // Clear previous audit log
  if (fs.existsSync(AUDIT_LOG)) fs.unlinkSync(AUDIT_LOG);

  // ---- PHASE 1: Core Endpoints ----
  console.log('\n========== PHASE 1: CORE ENDPOINTS ==========');
  
  // Matches — the only verified endpoint
  const matchesData = await discoverEndpoint(
    'Matches (current season)',
    '/matches',
    { season: '2025/2026' },
    'Fixtures, results, scores, status'
  );

  // Check pagination
  if (matchesData?.pagination) {
    console.log(`  Pagination: ${JSON.stringify(matchesData.pagination)}`);
  }

  // Get match count for current season
  let matchIds: string[] = [];
  if (matchesData?.rows) {
    matchIds = matchesData.rows.slice(0, 5).map((r: any) => r.id || r.match_id).filter(Boolean);
    console.log(`  Sample match IDs: ${matchIds.slice(0, 3).join(', ')}`);
  }

  // Matches — historical seasons
  const historicalSeasons = ['2024/2025', '2023/2024', '2022/2023', '2021/2022', '2020/2021', '2019/2020'];
  for (const season of historicalSeasons) {
    await discoverEndpoint(
      `Matches (${season})`,
      '/matches',
      { season },
      'Historical match data coverage'
    );
  }

  // ---- PHASE 2: Team Data ----
  console.log('\n========== PHASE 2: TEAM/PLAYER DATA ==========');
  
  await discoverEndpoint('Teams', '/teams', {}, 'Team identity, metadata');
  await discoverEndpoint('Team Matches', '/team_matches', { season: '2025/2026' }, 'Team-level match stats, xG');
  await discoverEndpoint('Player Matches', '/player_matches', { season: '2025/2026' }, 'Player-level match stats');
  await discoverEndpoint('Players', '/players', {}, 'Player metadata');

  // ---- PHASE 3: Competition Structure ----
  console.log('\n========== PHASE 3: COMPETITIONS ==========');
  
  const leaguesData = await discoverEndpoint('Leagues/Competitions', '/leagues', {}, 'Competition IDs, names');
  await discoverEndpoint('Seasons', '/seasons', {}, 'Available seasons');
  await discoverEndpoint('Standings', '/standings', { season: '2025/2026' }, 'League tables');

  // ---- PHASE 4: Other Data Sources ----
  console.log('\n========== PHASE 4: SUPPLEMENTARY DATA ==========');
  
  await discoverEndpoint('Managers', '/managers', {}, 'Manager metadata');
  await discoverEndpoint('Referees', '/referees', {}, 'Referee metadata');
  await discoverEndpoint('Transfers', '/transfers', {}, 'Transfer data');
  await discoverEndpoint('Injuries', '/injuries', { season: '2025/2026' }, 'Injury reports');
  await discoverEndpoint('Lineups', '/lineups', { season: '2025/2026' }, 'Match lineups');
  await discoverEndpoint('Events', '/events', { season: '2025/2026' }, 'Match events');
  await discoverEndpoint('Statistics', '/statistics', { season: '2025/2026' }, 'Match/team statistics');
  await discoverEndpoint('Venues', '/venues', {}, 'Stadium/venue data');
  await discoverEndpoint('H2H', '/h2h', {}, 'Head-to-head data');
  await discoverEndpoint('Form', '/form', {}, 'Team form');

  // ---- PHASE 5: ODDS DISCOVERY (G1) ----
  const hasOdds = await discoverOdds();

  // ---- PHASE 6: Pagination & Advanced Parameters ----
  console.log('\n========== PHASE 6: PAGINATION & PARAMETERS ==========');
  
  // Test pagination parameters
  await discoverEndpoint('Matches (page 2)', '/matches', { season: '2025/2026', page: 2 }, 'Pagination test');
  await discoverEndpoint('Matches (limit 50)', '/matches', { season: '2025/2026', limit: 50 }, 'Limit parameter test');
  await discoverEndpoint('Matches (offset)', '/matches', { season: '2025/2026', offset: 100 }, 'Offset parameter test');

  // Test competition-specific filters
  if (leaguesData?.rows?.[0]?.id) {
    const leagueId = leaguesData.rows[0].id;
    await discoverEndpoint(
      'Matches (by competition)',
      '/matches',
      { season: '2025/2026', league_id: leagueId },
      'Competition-filtered matches'
    );
  }

  // ---- PHASE 7: xG Discovery ----
  console.log('\n========== PHASE 7: xG & ADVANCED METRICS ==========');
  
  // Check if matches contain xG
  if (matchesData?.rows) {
    const sampleMatch = matchesData.rows[0];
    const xgFields = Object.keys(sampleMatch || {}).filter(k =>
      /xg|expected_goals|xga|expected_assists|shots|possession|ppda|deep/i.test(k)
    );
    console.log(`  xG fields in /matches: ${xgFields.length > 0 ? xgFields.join(', ') : 'NONE'}`);
  }

  // Check team_matches for xG
  const tmSchema = schemaRegistry['/team_matches'];
  if (tmSchema) {
    const xgFields = tmSchema.fields.filter((f: string) =>
      /xg|expected|shots|possession|ppda|deep/i.test(f)
    );
    console.log(`  xG fields in /team_matches: ${xgFields.length > 0 ? xgFields.join(', ') : 'NONE'}`);
  }

  // ---- PHASE 8: EPL-specific coverage depth ----
  console.log('\n========== PHASE 8: EPL COVERAGE DEPTH ==========');
  
  // Find EPL league ID from leagues data
  let eplLeagueId: string | null = null;
  if (leaguesData?.rows) {
    const eplLeague = leaguesData.rows.find((l: any) =>
      /premier league|epl|english premier/i.test(l.name || l.league_name || '')
    );
    if (eplLeague) {
      eplLeagueId = eplLeague.id || eplLeague.league_id;
      console.log(`  EPL League ID: ${eplLeagueId}`);
    }
  }

  if (eplLeagueId) {
    await discoverEndpoint(
      'EPL Matches 2024/25',
      '/matches',
      { season: '2024/2025', league_id: eplLeagueId },
      'EPL historical depth validation'
    );
  }

  // ============================================================================
  // GENERATE REPORTS
  // ============================================================================

  console.log('\n=========================================');
  console.log('GENERATING REPORTS');
  console.log('=========================================');

  // 1. Save schema registry
  fs.writeFileSync(
    path.join(SCHEMA_DIR, 'schema_registry.json'),
    JSON.stringify(schemaRegistry, null, 2)
  );

  // 2. G1 Assessment
  const g1Status = hasOdds ? 'PASS' : 'NOT AVAILABLE';

  // 3. Generate capability audit report
  const auditReport = generateAuditReport(g1Status);
  
  // Create docs/providers directory
  ensureDir(path.resolve('docs/providers'));
  fs.writeFileSync(
    path.resolve('docs/providers/dribble360-capability-audit.md'),
    auditReport
  );

  // 4. Save discovery summary
  const summary = {
    discoveryTimestamp: new Date().toISOString(),
    totalCalls: callCount,
    maxBudget: MAX_CALLS,
    g1_odds: g1Status,
    endpointsDiscovered: capabilities.filter(c => c.exists).length,
    endpointsFailed: capabilities.filter(c => !c.exists).length,
    schemas: Object.keys(schemaRegistry).length,
    rateLimitHeaders: callLog
      .filter(c => c.rateLimitHeaders.limit)
      .map(c => ({ endpoint: c.endpoint, ...c.rateLimitHeaders })),
    latencyStats: {
      p50: percentile(callLog.map(c => c.latencyMs).filter(l => l > 0), 50),
      p95: percentile(callLog.map(c => c.latencyMs).filter(l => l > 0), 95),
      max: Math.max(...callLog.map(c => c.latencyMs)),
    },
  };
  
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'discovery_summary.json'),
    JSON.stringify(summary, null, 2)
  );

  console.log('\n=========================================');
  console.log('DISCOVERY COMPLETE');
  console.log(`Total calls: ${callCount}/${MAX_CALLS}`);
  console.log(`G1 (Odds): ${g1Status}`);
  console.log(`Endpoints discovered: ${capabilities.filter(c => c.exists).length}`);
  console.log(`Reports saved to: docs/providers/dribble360-capability-audit.md`);
  console.log('=========================================');
}

function percentile(arr: number[], p: number): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)];
}

function generateAuditReport(g1Status: string): string {
  const lines: string[] = [];
  
  lines.push('# Dribble360 Capability Audit');
  lines.push('');
  lines.push(`**Discovery Date:** ${new Date().toISOString()}`);
  lines.push(`**Total API Calls Used:** ${callCount}/${MAX_CALLS}`);
  lines.push(`**Provider Status:** TRIAL_VALIDATION`);
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## G1 — Odds Capability');
  lines.push('');
  lines.push(`**Status: ${g1Status}**`);
  lines.push('');
  if (g1Status === 'NOT AVAILABLE') {
    lines.push('Dribble360 does not appear to provide odds data through any discovered endpoint.');
    lines.push('Evaluate as a **data/statistics/xG provider only**.');
  }
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Endpoint Capability Matrix');
  lines.push('');
  lines.push('| Capability | Exists | Endpoint | Parameters | Cost | Useful For | Evidence |');
  lines.push('|---|---|---|---|---|---|---|');
  
  for (const cap of capabilities) {
    lines.push(`| ${cap.capability} | ${cap.exists ? '✅' : '❌'} | \`${cap.endpoint}\` | ${cap.parameters} | ${cap.cost} | ${cap.usefulFor} | ${cap.evidence.slice(0, 100)} |`);
  }
  
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Schema Summary');
  lines.push('');
  
  for (const [endpoint, schema] of Object.entries(schemaRegistry)) {
    lines.push(`### \`${endpoint}\``);
    lines.push('');
    lines.push(`- **Records:** ${schema.recordCount}`);
    lines.push(`- **Fields:** ${schema.fields.join(', ')}`);
    if (schema.pagination) {
      lines.push(`- **Pagination:** ${JSON.stringify(schema.pagination)}`);
    }
    lines.push('');
    lines.push('```json');
    lines.push(JSON.stringify(schema.schema, null, 2));
    lines.push('```');
    lines.push('');
  }

  lines.push('---');
  lines.push('');
  lines.push('## Latency Profile');
  lines.push('');
  const latencies = callLog.map(c => c.latencyMs).filter(l => l > 0);
  lines.push(`- **p50:** ${percentile(latencies, 50)}ms`);
  lines.push(`- **p95:** ${percentile(latencies, 95)}ms`);
  lines.push(`- **max:** ${Math.max(...latencies)}ms`);
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('## Rate Limit Headers');
  lines.push('');
  const rlEntries = callLog.filter(c => c.rateLimitHeaders.limit);
  if (rlEntries.length > 0) {
    lines.push('| Endpoint | Limit | Remaining | Reset |');
    lines.push('|---|---|---|---|');
    for (const e of rlEntries.slice(0, 10)) {
      lines.push(`| ${e.endpoint} | ${e.rateLimitHeaders.limit} | ${e.rateLimitHeaders.remaining} | ${e.rateLimitHeaders.reset} |`);
    }
  } else {
    lines.push('No rate limit headers detected in responses.');
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## xG & Advanced Metrics Assessment');
  lines.push('');
  
  const tmSchema = schemaRegistry['/team_matches'];
  if (tmSchema) {
    const xgFields = tmSchema.fields.filter((f: string) =>
      /xg|expected|shots|possession|ppda|deep|goal|assist/i.test(f)
    );
    lines.push(`### team_matches xG/stats fields: ${xgFields.join(', ') || 'NONE'}`);
  }

  const mSchema = schemaRegistry['/matches'];
  if (mSchema) {
    const xgFields = mSchema.fields.filter((f: string) =>
      /xg|expected|shots|possession|ppda|deep|goal|assist/i.test(f)
    );
    lines.push(`### matches xG/stats fields: ${xgFields.join(', ') || 'NONE'}`);
  }

  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('*This report was automatically generated by the HandicapLab Dribble360 capability discovery pipeline.*');
  lines.push(`*Provider Status: TRIAL_VALIDATION — DO NOT expose to public or paying users.*`);

  return lines.join('\n');
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
