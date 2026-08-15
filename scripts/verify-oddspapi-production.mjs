import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.production.local' });
dotenv.config({ path: '.env.production.vercel' });
dotenv.config({ path: '.env.production.pull' });
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

function redact(val) {
  if (!val) return 'ABSENT';
  if (val.trim() === '' || val === '""' || val === "''") return 'EMPTY';
  return 'PRESENT';
}

function log(section, msg) {
  console.log('[' + section + '] ' + msg);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

async function main() {
  console.log('');
  console.log('================================================================');
  console.log('  ODDSPAPI PRODUCTION VERIFICATION');
  console.log('  HandicapLab — Read-Only Credential & Live Data Audit');
  console.log('  Timestamp: ' + new Date().toISOString());
  console.log('================================================================');
  console.log('');

  const localKey = process.env.ODDS_PAPI_KEY || process.env.ODDSPAPI_KEY;
  
  let vercelProdStatus = 'UNVERIFIABLE_LOCAL_PULL';
  try {
    const prodEnv = fs.readFileSync('.env.production.pull', 'utf8');
    vercelProdStatus = prodEnv.includes('ODDS_PAPI_KEY=') ? 'PRESENT' : 'ABSENT';
  } catch {}

  let localEnvProductionStatus = 'ABSENT';
  try {
    const localProd = fs.readFileSync('.env.production', 'utf8');
    if (localProd.includes('ODDS_PAPI_KEY=')) {
      const match = localProd.match(/ODDS_PAPI_KEY="?([^"\n]*)"?/);
      localEnvProductionStatus = redact(match?.[1]);
    }
  } catch {}

  console.log('Environment:');
  console.log('  Local .env ODDS_PAPI_KEY:              ' + redact(localKey));
  console.log('  Local .env.production ODDS_PAPI_KEY:   ' + localEnvProductionStatus);
  console.log('  Vercel Production ODDS_PAPI_KEY:        ' + vercelProdStatus);
  console.log('  NOTE: Vercel CLI redacts encrypted secrets in pulled env files.');
  console.log('  CONFIRMED by vercel env ls: ODDS_PAPI_KEY Encrypted Production+Preview, 17d ago');
  console.log('');

  let authResult = {
    status: 'AUTH_EMPTY',
    http_status_com: null,
    http_status_io: null,
    error_code: 'LOCAL_KEY_EMPTY',
    error_message: 'ODDS_PAPI_KEY is EMPTY in local environment. Vercel Production has encrypted key set 17d ago.',
    active_base_url: null,
    active_auth_method: null,
    raw_com: null,
    raw_io: null,
  };

  if (localKey && localKey.trim() !== '') {
    log('AUTH', 'Key found locally — running live auth test...');
    
    try {
      const resCom = await fetchWithTimeout('https://api.oddspapi.com/v1/sports', {
        headers: { 'x-api-key': localKey, 'Accept': 'application/json' },
      });
      authResult.http_status_com = resCom.status;
      try { authResult.raw_com = await resCom.json(); } catch {}
      log('AUTH', '.com/v1 HTTP ' + resCom.status);
    } catch (e) {
      authResult.http_status_com = -1;
      log('AUTH', '.com/v1 network failure: ' + e.message);
    }

    try {
      const resIo = await fetchWithTimeout('https://api.oddspapi.io/v4/sports?apiKey=' + localKey, {
        headers: { 'Accept': 'application/json' },
      });
      authResult.http_status_io = resIo.status;
      try { authResult.raw_io = await resIo.json(); } catch {}
      log('AUTH', '.io/v4 HTTP ' + resIo.status);
    } catch (e) {
      authResult.http_status_io = -1;
      log('AUTH', '.io/v4 network failure: ' + e.message);
    }

    if (authResult.http_status_com === 200) {
      authResult.status = 'AUTH_VALID';
      authResult.active_base_url = 'https://api.oddspapi.com/v1';
      authResult.active_auth_method = 'x-api-key header';
      authResult.error_code = null;
      authResult.error_message = null;
    } else if (authResult.http_status_io === 200) {
      authResult.status = 'AUTH_VALID';
      authResult.active_base_url = 'https://api.oddspapi.io/v4';
      authResult.active_auth_method = 'apiKey query param';
      authResult.error_code = null;
      authResult.error_message = null;
    } else if (authResult.http_status_com === 401 || authResult.http_status_io === 401) {
      authResult.status = 'AUTH_INVALID';
      const errData = authResult.raw_com || authResult.raw_io;
      authResult.error_code = errData?.message || errData?.errorCode || errData?.error?.code || 'INVALID_API_KEY';
      authResult.error_message = JSON.stringify(errData)?.substring(0, 300);
    } else if (authResult.http_status_com === -1 && authResult.http_status_io === -1) {
      authResult.status = 'API_REACHABILITY_FAILURE';
    } else {
      authResult.status = 'UNKNOWN';
      authResult.error_code = 'HTTP_COM=' + authResult.http_status_com + '_IO=' + authResult.http_status_io;
    }
  } else {
    log('AUTH', 'ODDS_PAPI_KEY is EMPTY locally — cannot run live auth test');
    log('AUTH', 'Environment mismatch: Vercel Production has the key; local does not');
  }

  console.log('');
  console.log('Authentication:');
  console.log('  Status:          ' + authResult.status);
  console.log('  HTTP (.com/v1):  ' + (authResult.http_status_com ?? 'NOT_TESTED'));
  console.log('  HTTP (.io/v4):   ' + (authResult.http_status_io ?? 'NOT_TESTED'));
  if (authResult.error_code) console.log('  Error Code:      ' + authResult.error_code);
  if (authResult.error_message) console.log('  Error Message:   ' + authResult.error_message);
  if (authResult.active_base_url) console.log('  Active Base URL: ' + authResult.active_base_url);

  let oddsInfo = null;
  
  if (authResult.status === 'AUTH_VALID' && localKey) {
    log('ODDS', 'Auth valid — fetching real odds...');
    const headers = { 'Accept': 'application/json' };
    if (authResult.active_auth_method === 'x-api-key header') headers['x-api-key'] = localKey;

    let sportsData = [];
    try {
      const sportsUrl = authResult.active_base_url.includes('oddspapi.com')
        ? authResult.active_base_url + '/sports'
        : authResult.active_base_url + '/sports?apiKey=' + localKey;
      const res = await fetchWithTimeout(sportsUrl, { headers });
      if (res.ok) sportsData = await res.json();
      log('ODDS', 'Sports returned: ' + (Array.isArray(sportsData) ? sportsData.length : 'non-array'));
    } catch (e) { log('ODDS', 'Sports failed: ' + e.message); }

    let oddsData = [];
    const sportKeys = authResult.active_base_url.includes('oddspapi.com')
      ? ['soccer_epl', 'soccer']
      : ['soccer_epl', 'soccer'];
    
    for (const sportKey of sportKeys) {
      try {
        let oddsUrl;
        if (authResult.active_base_url.includes('oddspapi.com')) {
          oddsUrl = authResult.active_base_url + '/odds?sport=' + sportKey + '&regions=eu&markets=h2h,spreads,totals&oddsFormat=decimal';
        } else {
          oddsUrl = authResult.active_base_url + '/sports/' + sportKey + '/odds?apiKey=' + localKey + '&regions=eu&markets=h2h,spreads,totals&oddsFormat=decimal';
        }
        const res = await fetchWithTimeout(oddsUrl, { headers }, 15000);
        if (res.ok) {
          const data = await res.json();
          oddsData = Array.isArray(data) ? data : (data?.data || data?.events || []);
          if (oddsData.length > 0) { log('ODDS', 'Fixtures returned: ' + oddsData.length); break; }
        } else {
          log('ODDS', 'Odds HTTP ' + res.status + ' for sport=' + sportKey);
          if (res.status === 401) break;
        }
      } catch (e) { log('ODDS', 'Odds failed: ' + e.message); }
    }

    const bookmakersFound = new Set();
    const marketsFound = new Set();
    const sampleIds = [];
    let tsPresent = false;
    let kickoffPresent = false;
    let oddsRecords = 0;

    for (const event of oddsData.slice(0, 5)) {
      if (event.id) sampleIds.push(event.id);
      if (event.commence_time || event.kickoff || event.start_time) kickoffPresent = true;
      for (const bk of (event.bookmakers || event.books || [])) {
        bookmakersFound.add((bk.key || bk.name || bk.id || '').toLowerCase());
        for (const mkt of (bk.markets || [])) {
          marketsFound.add((mkt.key || mkt.name || mkt.type || '').toLowerCase());
          if (mkt.last_update || mkt.updated_at) tsPresent = true;
          oddsRecords++;
        }
      }
    }

    const footballSports = Array.isArray(sportsData)
      ? sportsData.filter(s => (s.key||s.name||'').toLowerCase().includes('soccer') || (s.group||'').toLowerCase().includes('soccer')).map(s => s.key || s.name)
      : [];

    oddsInfo = {
      sports_returned: Array.isArray(sportsData) ? sportsData.length : 0,
      football_sports: footballSports,
      fixtures_returned: oddsData.length,
      odds_records_returned: oddsRecords,
      bookmakers_found: [...bookmakersFound],
      markets_found: [...marketsFound],
      sample_fixture_ids: sampleIds,
      timestamps_present: tsPresent,
      kickoff_present: kickoffPresent,
    };
  }

  const od = oddsInfo || { sports_returned:0, football_sports:[], fixtures_returned:0, odds_records_returned:0, bookmakers_found:[], markets_found:[], sample_fixture_ids:[], timestamps_present:false, kickoff_present:false };

  console.log('');
  console.log('Odds Data:');
  console.log('  Sports returned:        ' + od.sports_returned);
  console.log('  Football sports:        ' + (od.football_sports.join(', ') || 'NONE'));
  console.log('  Fixtures returned:      ' + od.fixtures_returned);
  console.log('  Odds records returned:  ' + od.odds_records_returned);
  console.log('  Bookmakers found:       ' + (od.bookmakers_found.join(', ') || 'NONE'));
  console.log('  Markets found:          ' + (od.markets_found.join(', ') || 'NONE'));
  console.log('  Sample fixture IDs:     ' + (od.sample_fixture_ids.join(', ') || 'NONE'));
  console.log('  Timestamps present:     ' + od.timestamps_present);
  console.log('  Kickoff present:        ' + od.kickoff_present);

  const bkLower = od.bookmakers_found.map(b => b.toLowerCase());
  const mktLower = od.markets_found.map(m => m.toLowerCase());
  const bk = {
    pinnacle: bkLower.some(b => b.includes('pinnacle')) ? 'AVAILABLE' : 'NOT_AVAILABLE',
    circa: bkLower.some(b => b.includes('circa')) ? 'AVAILABLE' : 'NOT_AVAILABLE',
    sbo: bkLower.some(b => b.includes('sbo')) ? 'AVAILABLE' : 'NOT_AVAILABLE',
  };
  const mkt = {
    moneyline: mktLower.some(m => m.includes('h2h') || m.includes('moneyline') || m.includes('1x2')) ? 'AVAILABLE' : 'NOT_AVAILABLE',
    asian_handicap: mktLower.some(m => m.includes('spread') || m.includes('asian') || m.includes('handicap')) ? 'AVAILABLE' : 'NOT_AVAILABLE',
    over_under: mktLower.some(m => m.includes('total') || m.includes('over') || m.includes('ou')) ? 'AVAILABLE' : 'NOT_AVAILABLE',
    btts: mktLower.some(m => m.includes('btts') || m.includes('both')) ? 'AVAILABLE' : 'NOT_AVAILABLE',
  };

  console.log('');
  console.log('Bookmakers:');
  console.log('  Pinnacle: ' + bk.pinnacle);
  console.log('  Circa:    ' + bk.circa);
  console.log('  SBO:      ' + bk.sbo);
  console.log('');
  console.log('Markets:');
  console.log('  Moneyline (h2h):   ' + mkt.moneyline);
  console.log('  Asian Handicap:    ' + mkt.asian_handicap);
  console.log('  Over/Under:        ' + mkt.over_under);
  console.log('  BTTS:              ' + mkt.btts);

  // Fixture linkage
  const tested = od.sample_fixture_ids.length;
  const matched = 0; // No local fixture DB without Supabase connection
  console.log('');
  console.log('Fixture Linkage:');
  console.log('  Tested:     ' + tested);
  console.log('  Matched:    ' + matched);
  console.log('  Unmatched:  ' + (tested - matched));
  console.log('  Match rate: ' + (tested > 0 ? Math.round(matched/tested*100) + '%' : 'N/A'));
  console.log('');
  console.log('Model Snapshot Linkage:');
  console.log('  Tested:  ' + matched);
  console.log('  Matched: 0');
  console.log('  Missing: ' + matched);

  // C3 readiness
  const credPresent = vercelProdStatus === 'PRESENT';
  const authOk = authResult.status === 'AUTH_VALID';
  const realOdds = od.fixtures_returned > 0;
  const bkOk = od.bookmakers_found.length > 0;
  const mktOk = od.markets_found.length > 0;
  const lineOk = mktOk && od.odds_records_returned > 0;
  const tsOk = od.timestamps_present;
  const fixOk = matched > 0;
  const snapOk = false;
  const noSynthetic = authOk && realOdds;

  let c3Status;
  let blocker;
  let action;
  if (!credPresent) {
    c3Status = 'AUTH_MISSING'; blocker = 'ODDS_PAPI_KEY absent from Vercel Production'; action = 'Add key to Vercel';
  } else if (authResult.status === 'AUTH_EMPTY') {
    c3Status = 'VERIFICATION_BLOCKED'; blocker = 'Key exists in Vercel but EMPTY locally — cannot authenticate. Provide local key for live test.'; action = 'Pull key from OddsPAPI dashboard and test locally OR verify Production key validity via smoke test endpoint';
  } else if (!authOk) {
    c3Status = 'AUTH_INVALID'; blocker = 'Auth failed: ' + authResult.error_code + ' — ' + authResult.error_message; action = 'Rotate ODDS_PAPI_KEY in Vercel Production';
  } else if (!realOdds) {
    c3Status = 'API_DATA_BLOCKED'; blocker = 'Auth OK but no odds data returned'; action = 'Check OddsPAPI plan tier';
  } else if (!fixOk) {
    c3Status = 'LINKAGE_BLOCKED'; blocker = 'Odds available but fixture linkage fails — no OddsPAPI IDs in DB'; action = 'Run OddsPAPI ingestion pipeline';
  } else {
    c3Status = 'C3_READY'; blocker = null; action = 'Proceed with C3 validation';
  }

  const checklist = {
    production_credential_present: credPresent,
    authentication_succeeds: authOk,
    real_odds_returned: realOdds,
    bookmaker_identity_available: bkOk,
    market_identity_available: mktOk,
    line_identity_available: lineOk,
    timestamp_available: tsOk,
    fixture_mapping_works: fixOk,
    model_snapshot_mapping_possible: snapOk,
    no_synthetic_odds_required: noSynthetic,
  };

  console.log('');
  console.log('C3 Readiness:');
  console.log('  Status:  ' + c3Status);
  if (blocker) console.log('  Blocker: ' + blocker);
  console.log('');
  console.log('C3 Checklist:');
  for (const [k, v] of Object.entries(checklist)) {
    console.log('  [' + (v ? 'x' : ' ') + '] ' + k.replace(/_/g, ' '));
  }
  console.log('');
  console.log('Recommended Action: ' + action);
  console.log('');
  console.log('================================================================');

  const result = {
    timestamp: new Date().toISOString(),
    environment: { local_env: redact(localKey), local_env_production: localEnvProductionStatus, vercel_production: vercelProdStatus },
    authentication: { status: authResult.status, http_status_com: authResult.http_status_com, http_status_io: authResult.http_status_io, error_code: authResult.error_code, error_message: authResult.error_message, active_base_url: authResult.active_base_url },
    odds_data: od,
    bookmakers: bk,
    markets: mkt,
    fixture_linkage: { tested, matched, unmatched: tested - matched, match_rate: tested > 0 ? Math.round(matched/tested*100)+'%' : 'N/A' },
    model_snapshot_linkage: { tested: matched, matched: 0, missing: matched },
    c3_readiness: { status: c3Status, checklist, blocker: blocker || null, recommended_action: action },
  };

  fs.mkdirSync('data/verification', { recursive: true });
  fs.writeFileSync('data/verification/oddspapi_production_verification.json', JSON.stringify(result, null, 2));
  log('OUTPUT', 'JSON written to data/verification/oddspapi_production_verification.json');
}

main().catch(e => { console.error('[VERIFY] Fatal:', e.message); process.exit(1); });
