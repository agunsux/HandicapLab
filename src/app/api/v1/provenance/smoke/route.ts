import { NextResponse } from 'next/server';
import { validateCredential } from '@/lib/auth/credentialValidator';
import { canonicalEntityResolver } from '@/lib/warehouse/entityResolver';
import type { ApiFootballProvider } from '@/lib/providers/apiFootballProvider';

export const dynamic = 'force-dynamic';

// Minimum provenance status taxonomy. All outcomes collapse into one of these
// fail-closed states — never a generic boolean.
export const PROVENANCE_STATUSES = [
  'VERIFIED_LIVE',
  'VERIFICATION_FAILED',
  'AUTH_FAILED',
  'PROVIDER_UNAVAILABLE',
  'RECORD_NOT_FOUND',
  'SCHEMA_INVALID',
  'PROVENANCE_MISSING',
] as const;

export type ProvenanceStatus = (typeof PROVENANCE_STATUSES)[number];

const KICKOFF_TOLERANCE_MS = 15 * 60 * 1000;

function fail(
  status: ProvenanceStatus | 'ODDSPAPI_LIVE_AUTH_FAILED',
  message: string,
  extra: Record<string, unknown> = {},
  httpStatus = 503
) {
  return NextResponse.json({ success: false, status, message, ...extra }, { status: httpStatus });
}

function cleanTeamName(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isDummyIdentifier(name: string | null): boolean {
  if (!name) return false;
  const lower = name.toLowerCase();
  return (
    lower.includes('mock') ||
    lower.includes('dummy') ||
    lower.includes('synthetic') ||
    lower.includes('placeholder') ||
    lower.includes('test team')
  );
}

interface ResolvedRecord {
  ledgerId: string | null;
  matchId: string | null;
  providerFixtureId: string | null;
  home: string | null;
  away: string | null;
  kickoff: string | null;
  competition: string | null;
  source: string | null;
  rowFields: {
    home: boolean;
    away: boolean;
    kickoff: boolean;
    matchId: boolean;
    providerFixtureId: boolean;
    league: boolean;
  };
  // Where the resolved identity came from: either the ledger row itself ('row'),
  // the canonical `matches` join ('joined'), or the join failed ('error' /
  // 'not_found' / 'skipped' when no match_id exists). Read-only, non-secret.
  matchJoin: 'row' | 'joined' | 'not_found' | 'error' | 'skipped';
  matchJoinError: string | null;
}

// Resolve team identity + kickoff for a ledger row. Prefers flat columns when
// present; otherwise joins the canonical `matches` row by match_id (read-only).
// Eligibility semantics are unchanged; this only records WHY a row could not be
// resolved so the gate can distinguish validator bugs from incomplete records.
async function resolveRecord(row: any, supabase: any): Promise<ResolvedRecord> {
  const rowHome = cleanTeamName(row.home_team);
  const rowAway = cleanTeamName(row.away_team);
  const rowKickoff = cleanTeamName(row.kickoff) ?? cleanTeamName(row.kickoff_utc);
  let home = rowHome;
  let away = rowAway;
  let kickoff = rowKickoff;
  let competition = cleanTeamName(row.league) ?? cleanTeamName(row.cohort_tag);
  const matchId = typeof row.match_id === 'string' && row.match_id.length > 0 ? row.match_id : null;
  let providerFixtureId =
    typeof row.external_match_id === 'string' && row.external_match_id.length > 0
      ? row.external_match_id
      : null;
  let source = cleanTeamName(row.source);

  const rowFields = {
    home: rowHome !== null,
    away: rowAway !== null,
    kickoff: rowKickoff !== null,
    matchId: matchId !== null,
    providerFixtureId: providerFixtureId !== null,
    league: competition !== null,
  };

  let matchJoin: ResolvedRecord['matchJoin'] = matchId ? 'not_found' : 'skipped';
  let matchJoinError: string | null = null;

  if ((!home || !away || !kickoff || !providerFixtureId) && matchId) {
    try {
      // NOTE: only columns that exist on the live production `matches` table
      // may be selected here. `external_match_id` and `source` are defined in
      // an early migration but are absent from the deployed schema (verified in
      // production: `column matches.external_match_id does not exist`), and a
      // PostgREST 400 on the join silently left every record SCHEMA_INVALID.
      const { data: match, error: matchError } = await supabase
        .from('matches')
        .select('id, home_team, away_team, kickoff, league')
        .eq('id', matchId)
        .maybeSingle();
      if (matchError) {
        matchJoin = 'error';
        matchJoinError = String(matchError?.message || matchError);
      } else if (match) {
        matchJoin = 'joined';
        home = home ?? cleanTeamName(match.home_team);
        away = away ?? cleanTeamName(match.away_team);
        kickoff = kickoff ?? cleanTeamName(match.kickoff);
        providerFixtureId = providerFixtureId ?? cleanTeamName(match.external_match_id);
        source = source ?? cleanTeamName(match.source);
        competition = competition ?? cleanTeamName(match.league);
      } else {
        matchJoin = 'not_found';
      }
    } catch (err: any) {
      // Read-only resolution failure: leave unresolved, record will be
      // classified PROVENANCE_MISSING / SCHEMA_INVALID downstream.
      matchJoin = 'error';
      matchJoinError = err?.message || String(err);
    }
  }

  return {
    ledgerId: typeof row.id === 'string' ? row.id : null,
    matchId,
    providerFixtureId,
    home,
    away,
    kickoff,
    competition,
    source,
    rowFields,
    matchJoin,
    matchJoinError,
  };
}

// Non-secret per-record provenance diagnostics for the gate output. Never
// includes credential values; identity/kickoff fields are team names and match
// identity, not secrets.
function diagnosticsFor(resolved: Array<{ record: ResolvedRecord; status: ProvenanceStatus; reason: string }>) {
  return resolved.map(({ record: r, status, reason }) => ({
    id: r.ledgerId,
    match_id: r.matchId,
    provider_fixture_id: r.providerFixtureId,
    home_team: r.home,
    away_team: r.away,
    kickoff: r.kickoff,
    kickoff_valid: r.kickoff ? !Number.isNaN(Date.parse(r.kickoff)) : false,
    league: r.competition,
    source: r.source,
    row_fields: r.rowFields,
    match_join: r.matchJoin,
    match_join_error: r.matchJoinError,
    status,
    reason,
  }));
}

function canonicalFor(provider: string, name: string): string {
  return canonicalEntityResolver.resolveTeamId(provider, name);
}

// Classify an API-Football verification error into a fail-closed status.
function classifyApiFootballError(err: unknown): { status: ProvenanceStatus; reason: string } {
  const msg = err instanceof Error ? err.message : String(err);
  if (/401|403|unauthorized|invalid key/i.test(msg)) {
    return { status: 'AUTH_FAILED', reason: `API-Football authentication rejected: ${msg}` };
  }
  if (/429/i.test(msg)) {
    return { status: 'PROVIDER_UNAVAILABLE', reason: `API-Football rate limited: ${msg}` };
  }
  return { status: 'PROVIDER_UNAVAILABLE', reason: `API-Football request failed: ${msg}` };
}

export async function GET() {
  // ─── 1. Fail-closed credential validation (ordered, values never printed) ───
  // OddsPAPI is gated first so an unverifiable OddsPAPI credential always
  // resolves to ODDSPAPI_LIVE_AUTH_FAILED.
  try {
    validateCredential('ODDS_PAPI_KEY', process.env.ODDS_PAPI_KEY, 'opaque');
  } catch (err: any) {
    return fail('ODDSPAPI_LIVE_AUTH_FAILED', err.message);
  }

  try {
    validateCredential('APIFOOTBALL_KEY', process.env.APIFOOTBALL_KEY || process.env.API_FOOTBALL_KEY, 'opaque');
  } catch (err: any) {
    return fail('AUTH_FAILED', err.message);
  }

  try {
    validateCredential('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY, 'jwt');
  } catch (err: any) {
    return fail('AUTH_FAILED', err.message);
  }

  let supabase;
  try {
    const mod = await import('@/lib/supabase.server');
    supabase = mod.supabase;
  } catch (err: any) {
    return fail('AUTH_FAILED', `Supabase service-role credential rejected: ${err.message}`);
  }

  // ─── 2. Read-only record selection from the production ledger ───
  let rows: any[];
  try {
    const { data, error } = await supabase
      .from('prediction_ledger_v3')
      .select('*')
      .order('prediction_timestamp', { ascending: false })
      .limit(12);
    if (error) {
      const msg = String(error.message || '').toLowerCase();
      if (/invalid api key|unauthorized|401|403|permission|jwt/i.test(msg)) {
        return fail('AUTH_FAILED', `Supabase query rejected: ${error.message}`);
      }
      return fail('VERIFICATION_FAILED', `Supabase query failed: ${error.message}`, {}, 500);
    }
    rows = data ?? [];
  } catch (err: any) {
    return fail('PROVIDER_UNAVAILABLE', `Supabase unavailable: ${err.message}`);
  }

  if (rows.length === 0) {
    return fail('RECORD_NOT_FOUND', 'No records found in prediction_ledger_v3.', { verifiedCount: 0 });
  }

  // ─── 3. Resolve records, enforce schema + provenance-identity eligibility ───
  const resolved: Array<{ record: ResolvedRecord; status: ProvenanceStatus; reason: string }> = [];
  for (const row of rows) {
    const r = await resolveRecord(row, supabase);

    if (!r.home || !r.away || !r.kickoff || Number.isNaN(Date.parse(r.kickoff))) {
      resolved.push({ record: r, status: 'SCHEMA_INVALID', reason: 'Record is missing home_team/away_team/kickoff or has an invalid kickoff.' });
      continue;
    }
    if (isDummyIdentifier(r.home) || isDummyIdentifier(r.away) || isDummyIdentifier(r.matchId)) {
      resolved.push({ record: r, status: 'SCHEMA_INVALID', reason: 'Record contains dummy, mock, or synthetic identifiers.' });
      continue;
    }
    if (!r.matchId && !r.providerFixtureId) {
      resolved.push({ record: r, status: 'PROVENANCE_MISSING', reason: 'Record has no provider or canonical fixture identity to verify.' });
      continue;
    }

    resolved.push({ record: r, status: 'VERIFICATION_FAILED', reason: 'pending live verification' });
  }

  const eligible = resolved.filter((r) => r.status === 'VERIFICATION_FAILED');
  const schemaInvalid = resolved.filter((r) => r.status === 'SCHEMA_INVALID');
  const provenanceMissing = resolved.filter((r) => r.status === 'PROVENANCE_MISSING');

  if (eligible.length < 3) {
    if (resolved.length > 0 && schemaInvalid.length === resolved.length) {
      return fail('SCHEMA_INVALID', 'All scanned records failed schema validation.', {
        eligibleCount: eligible.length,
        totalRecordsScanned: rows.length,
        diagnostics: diagnosticsFor(resolved),
      });
    }
    if (provenanceMissing.length > 0 && eligible.length === 0) {
      return fail('PROVENANCE_MISSING', 'No scanned record carries a genuine provider fixture identity.', {
        eligibleCount: 0,
        totalRecordsScanned: rows.length,
        diagnostics: diagnosticsFor(resolved),
      });
    }
    return fail('RECORD_NOT_FOUND', `Only ${eligible.length} eligible records found (need 3).`, {
      eligibleCount: eligible.length,
      totalRecordsScanned: rows.length,
      diagnostics: diagnosticsFor(resolved),
    });
  }

  const selected = eligible.slice(0, 3);

  // ─── 4. Fresh live API-Football verification ───
  let apiFootball: ApiFootballProvider;
  try {
    const { ApiFootballProvider } = await import('@/lib/providers/apiFootballProvider');
    apiFootball = new ApiFootballProvider();
  } catch (err: any) {
    return fail('AUTH_FAILED', `API-Football credential rejected: ${err.message}`);
  }

  const apiFootballResults: Record<string, { status: ProvenanceStatus; providerFixtureId: string | null; reason: string }> = {};

  for (const item of selected) {
    const r = item.record;
    const dateStr = new Date(r.kickoff!).toISOString().split('T')[0];
    try {
      const result = await apiFootball.getFixturesByDate(dateStr);
      const fixtures: any[] = Array.isArray(result?.response) ? result.response : [];
      if (fixtures.length === 0) {
        apiFootballResults[r.matchId ?? r.home!] = {
          status: 'VERIFICATION_FAILED',
          providerFixtureId: null,
          reason: `No fixtures returned by API-Football for date ${dateStr}.`,
        };
        continue;
      }

      const canonicalHomeDb = canonicalFor('api_football', r.home!);
      const canonicalAwayDb = canonicalFor('api_football', r.away!);
      let matchedFixture: any = null;
      for (const fixture of fixtures) {
        const rawHome = cleanTeamName(fixture?.teams?.home?.name);
        const rawAway = cleanTeamName(fixture?.teams?.away?.name);
        if (!rawHome || !rawAway) continue;
        if (canonicalFor('api_football', rawHome) !== canonicalHomeDb) continue;
        if (canonicalFor('api_football', rawAway) !== canonicalAwayDb) continue;
        matchedFixture = fixture;
        break;
      }

      if (matchedFixture) {
        apiFootballResults[r.matchId ?? r.home!] = {
          status: 'VERIFIED_LIVE',
          providerFixtureId: String(matchedFixture.fixture?.id ?? ''),
          reason: `Exact entity match: ${r.home} vs ${r.away} on ${dateStr} (provider fixture ${matchedFixture.fixture?.id}).`,
        };
      } else {
        apiFootballResults[r.matchId ?? r.home!] = {
          status: 'VERIFICATION_FAILED',
          providerFixtureId: null,
          reason: `No exact entity match for ${r.home} vs ${r.away} in API-Football feed for ${dateStr}.`,
        };
      }
    } catch (err: any) {
      const cls = classifyApiFootballError(err);
      apiFootballResults[r.matchId ?? r.home!] = {
        status: cls.status,
        providerFixtureId: null,
        reason: cls.reason,
      };
    }
  }

  const afAuthFailed = Object.values(apiFootballResults).some((r) => r.status === 'AUTH_FAILED');
  const afUnavailable = Object.values(apiFootballResults).some((r) => r.status === 'PROVIDER_UNAVAILABLE');
  if (afAuthFailed) {
    return fail('AUTH_FAILED', 'API-Football live authentication failed during provenance verification.', {
      api_football: apiFootballResults,
    });
  }
  if (afUnavailable) {
    return fail('PROVIDER_UNAVAILABLE', 'API-Football provider was unavailable during provenance verification.', {
      api_football: apiFootballResults,
    });
  }

  // ─── 5. Fresh live OddsPAPI verification (auth + per-record evidence) ───
  let oddsProviderStatus: string;
  let oddsFixtures: any[] = [];
  let oddsDetail: string;
  try {
    const { oddsPapiV4Provider } = await import('@/lib/data/providers/odds/native');
    const result = await oddsPapiV4Provider.fetchNormalizedOdds();
    oddsFixtures = Array.isArray(result.sharp) ? result.sharp : [];
    oddsProviderStatus = 'HEALTHY';
    oddsDetail = `fresh response: ${result.snapshots?.length ?? 0} snapshots across ${oddsFixtures.length} fixtures.`;
  } catch (err: any) {
    const kind = typeof err?.kind === 'string' ? err.kind : '';
    if (kind === 'INVALID_KEY' || /401|invalid key/i.test(String(err?.message ?? err))) {
      return fail('ODDSPAPI_LIVE_AUTH_FAILED', `OddsPAPI rejected credentials during live verification: ${err?.message ?? ''}`);
    }
    if (kind === 'RATE_LIMITED' || kind === 'QUOTA') {
      return fail('PROVIDER_UNAVAILABLE', `OddsPAPI throttled during live verification: ${err?.message ?? ''}`);
    }
    return fail('PROVIDER_UNAVAILABLE', `OddsPAPI unavailable during live verification: ${err?.message ?? ''}`);
  }

  const oddsResults: Record<string, { status: 'MATCHED' | 'VERIFICATION_FAILED'; matchedFixtureId: string | null; bookmakers: string[]; markets: string[]; reason: string }> = {};

  for (const item of selected) {
    const r = item.record;
    const canonicalHome = canonicalFor('api_football', r.home!);
    const canonicalAway = canonicalFor('api_football', r.away!);
    const kickoffMs = Date.parse(r.kickoff!);
    let matched: any = null;

    for (const fixture of oddsFixtures) {
      const fHome = cleanTeamName(fixture.homeTeam);
      const fAway = cleanTeamName(fixture.awayTeam);
      const fKickoff = cleanTeamName(fixture.commenceTime);
      if (!fHome || !fAway || !fKickoff) continue;
      if (canonicalFor('oddspapi', fHome) !== canonicalHome) continue;
      if (canonicalFor('oddspapi', fAway) !== canonicalAway) continue;
      const diff = Math.abs(Date.parse(fKickoff) - kickoffMs);
      if (diff > KICKOFF_TOLERANCE_MS) continue;
      matched = fixture;
      break;
    }

    if (matched) {
      const bookmakers = Array.isArray(matched.bookmakers)
        ? matched.bookmakers.map((b: any) => String(b?.key ?? '')).filter(Boolean)
        : [];
      const markets = new Set<string>();
      for (const b of Array.isArray(matched.bookmakers) ? matched.bookmakers : []) {
        for (const m of Array.isArray(b?.markets) ? b.markets : []) {
          if (m?.key) markets.add(String(m.key));
        }
      }
      oddsResults[r.matchId ?? r.home!] = {
        status: 'MATCHED',
        matchedFixtureId: String(matched.fixtureId ?? ''),
        bookmakers,
        markets: Array.from(markets),
        reason: `Odds evidence matched fixture ${matched.fixtureId} (${r.home} vs ${r.away}) from fresh OddsPAPI response.`,
      };
    } else {
      oddsResults[r.matchId ?? r.home!] = {
        status: 'VERIFICATION_FAILED',
        matchedFixtureId: null,
        bookmakers: [],
        markets: [],
        reason: `No matching odds evidence for ${r.home} vs ${r.away} in the fresh OddsPAPI response.`,
      };
    }
  }

  // ─── 6. Aggregate per-record + overall status ───
  const results = selected.map((item) => {
    const r = item.record;
    const key = r.matchId ?? r.home!;
    const af = apiFootballResults[key];
    const odds = oddsResults[key];
    const bothVerified = af?.status === 'VERIFIED_LIVE' && odds?.status === 'MATCHED';
    return {
      match_id: r.matchId,
      canonical_fixture_id: r.providerFixtureId ?? r.matchId,
      competition: r.competition ?? 'Unknown',
      home_team: r.home,
      away_team: r.away,
      kickoff_utc: r.kickoff,
      status: bothVerified ? 'VERIFIED_LIVE' : 'VERIFICATION_FAILED',
      api_football: af ?? { status: 'VERIFICATION_FAILED', providerFixtureId: null, reason: 'not run' },
      oddspapi: odds ?? { status: 'VERIFICATION_FAILED', matchedFixtureId: null, bookmakers: [], markets: [], reason: 'not run' },
    };
  });

  const verifiedCount = results.filter((r) => r.status === 'VERIFIED_LIVE').length;

  if (verifiedCount < 3) {
    return fail('VERIFICATION_FAILED', `PASS = ${verifiedCount}/3 independently verified across both live providers.`, {
      verifiedCount,
      eligibleCount: eligible.length,
      api_football: { auth: 'VALIDATED', detail: 'live verification executed' },
      oddspapi: { auth: 'VALIDATED', provider_status: oddsProviderStatus, detail: oddsDetail },
      results,
    });
  }

  return NextResponse.json({
    success: true,
    status: 'VERIFIED_LIVE',
    message: 'PASS = 3/3 independently verified',
    verifiedCount,
    eligibleCount: eligible.length,
    api_football: { auth: 'VALIDATED', detail: 'live verification executed' },
    oddspapi: { auth: 'VALIDATED', provider_status: oddsProviderStatus, detail: oddsDetail },
    results,
  });
}
