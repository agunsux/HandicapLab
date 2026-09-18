import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

/**
 * CONTROLLED SINGLE PROBE FOR FOOTYSTATS FREE TRIAL (GATE G-A / G-B)
 * Location: src/scripts/footystats-single-probe.ts
 *
 * Invariants:
 * - Exactly ONE isolated request (0 retries).
 * - Key is redacted in all outputs.
 * - API-Football: 0 requests.
 * - OddsPapi: 0 requests.
 */
if (!process.argv.includes('--allow-manual-probe')) {
  console.error('[GATEWAY_SAFETY_ERROR] Direct provider probes are quarantined per P0 safety policy.');
  console.error('To run explicitly for diagnostic inspection, provide: --allow-manual-probe');
  process.exit(1);
}

async function runSingleProbe() {
  const rawKey = process.env.FOOTYSTATS_API_KEY;
  if (!rawKey || !rawKey.trim()) {
    console.error(JSON.stringify({
      gateGA: 'FAILED',
      gateGB: 'BLOCKED',
      error: 'FOOTYSTATS_API_KEY not found in .env',
      quotaConsumed: 0
    }, null, 2));
    process.exit(1);
  }

  const key = rawKey.trim();
  const redactedKey = `${key.slice(0, 4)}***${key.slice(-2)}`;
  console.log(`[Gate G-A] Key detected in .env: ${redactedKey} (length: ${key.length})`);

  // Target: EPL 2018/19 (season_id 1625) with small page size for probe
  const endpoint = `https://api.football-data-api.com/league-matches?key=${encodeURIComponent(key)}&season_id=1625&max_per_page=5`;
  const sanitizedUrl = endpoint.replace(encodeURIComponent(key), '[REDACTED_KEY]');
  console.log(`[Single Probe] Dispatching single HTTP GET to: ${sanitizedUrl}`);

  const startTime = Date.now();
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'HandicapLab-Research/1.0',
      },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const latencyMs = Date.now() - startTime;
    const status = response.status;
    const statusText = response.statusText;

    // Collect relevant rate-limit or plan headers
    const headerInfo: Record<string, string> = {};
    for (const [k, v] of response.headers.entries()) {
      if (
        k.includes('ratelimit') ||
        k.includes('limit') ||
        k.includes('quota') ||
        k.includes('plan') ||
        k === 'content-type'
      ) {
        headerInfo[k] = v;
      }
    }

    const text = await response.text();
    let json: any = null;
    try {
      json = JSON.parse(text);
    } catch {
      // Not JSON
    }

    const report = {
      timestamp: new Date().toISOString(),
      probe: 'FootyStats EPL /league-matches',
      httpStatus: status,
      statusText,
      latencyMs,
      headers: headerInfo,
      quotaConsumed: 1,
      gateGA: 'PASSED',
      gateGB: status === 200 && json?.success !== false ? 'PASSED' : 'BLOCKED',
      apiFootballRequests: 0,
      oddsPapiRequests: 0,
      payloadSummary: json ? {
        success: json.success,
        message: json.message,
        pager: json.pager,
        dataLength: Array.isArray(json.data) ? json.data.length : (json.data ? typeof json.data : null),
        sampleFields: Array.isArray(json.data) && json.data.length > 0 ? Object.keys(json.data[0]).slice(0, 30) : [],
        keyOddsFieldsFound: Array.isArray(json.data) && json.data.length > 0 ? {
          has_odds_ft_1: 'odds_ft_1' in json.data[0],
          has_odds_btts_yes: 'odds_btts_yes' in json.data[0],
          has_odds_ft_over25: 'odds_ft_over25' in json.data[0],
          sample_odds_ft_1: json.data[0].odds_ft_1,
          sample_odds_btts_yes: json.data[0].odds_btts_yes,
          sample_odds_ft_over25: json.data[0].odds_ft_over25,
        } : null,
      } : { rawSnippet: text.slice(0, 300) },
    };

    console.log('\n--- PROBE EXECUTION RESULT ---');
    console.log(JSON.stringify(report, null, 2));

  } catch (err: any) {
    const latencyMs = Date.now() - startTime;
    console.error('\n--- PROBE EXECUTION FAILED ---');
    console.error(JSON.stringify({
      timestamp: new Date().toISOString(),
      probe: 'FootyStats EPL /league-matches',
      error: (err.message || String(err)).replace(key, '[REDACTED_KEY]'),
      latencyMs,
      quotaConsumed: 1,
      gateGA: 'PASSED',
      gateGB: 'BLOCKED',
      apiFootballRequests: 0,
      oddsPapiRequests: 0,
    }, null, 2));
    process.exit(1);
  }
}

runSingleProbe();
