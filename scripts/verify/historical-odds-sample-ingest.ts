// ============================================================================
// INCREMENT 2 — CONTROLLED HISTORICAL ODDS SAMPLE INGESTION
// ============================================================================
// Real OddsPapi /v4/historical-odds (UNMETERED) → normalization → canonical
// fixture mapping → entry/closing selection → canonical storage rows.
//
// Controlled sample: one finished EPL fixture per month (Feb–May 2026) so the
// canonical dataset (2025-2026 season) is guaranteed to cover the period.
//
// Everything is fail-closed:
//   - unmapped fixtures produce NO odds rows
//   - missing closing produces NO closing row
//   - missing line produces LINE_MISSING rejections
//   - DB writes are skipped and classified when schema is unavailable
//
// Usage: npx tsx scripts/verify/historical-odds-sample-ingest.ts [--limit=4]

import './_load-env';
import * as fs from 'fs';
import * as path from 'path';
import { NativeOddsClient, OddsPapiError } from '../../src/lib/data/providers/odds/native/client';
import { normalizeHistoricalOdds } from '../../src/lib/data/providers/odds/native/normalize';
import { loadMarketCatalog } from '../../src/historical/oddspapi/marketCatalog';
import { buildMarketObservationSets } from '../../src/historical/oddspapi/observationSeries';
import { buildHistoricalOddsRows, type HistoricalOddsRow } from '../../src/historical/oddspapi/storageRows';
import {
  FixtureMappingEngine,
  loadTeamAliases,
  loadLeagueMap,
  loadCanonicalFixturesFromJsonl,
  decisionToMappingRow,
  detectDuplicateProviderEvents,
  type CanonicalFixtureRef,
  type MappingDecision,
} from '../../src/lib/identity/fixtureMapping';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY || '';
const BOOKMAKERS = ['pinnacle'];
const CANONICAL_FILE = 'data/golden/europe/canonical_matches.jsonl';

function argValue(name: string, fallback: string): string {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split('=')[1] : fallback;
}

async function rest(endpoint: string, init: RequestInit = {}): Promise<{ status: number; body: any }> {
  const res = await fetch(`${supabaseUrl}/rest/v1${endpoint}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: any = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // raw text
  }
  return { status: res.status, body };
}

function countRawEntries(response: any): number {
  let count = 0;
  for (const book of Object.values(response?.bookmakers ?? {}) as any[]) {
    for (const market of Object.values(book.markets ?? {}) as any[]) {
      for (const outcome of Object.values(market.outcomes ?? {}) as any[]) {
        for (const entries of Object.values(outcome.players ?? {}) as any[]) {
          count += Array.isArray(entries) ? entries.length : 1;
        }
      }
    }
  }
  return count;
}

function increment(map: Record<string, number>, key: string, by = 1): void {
  map[key] = (map[key] ?? 0) + by;
}

async function run(): Promise<void> {
  const limit = parseInt(argValue('limit', '4'), 10);
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const outDir = path.resolve('data/historical/oddspapi/ingested', runId);
  const rawDir = path.resolve('data/historical/oddspapi/raw');
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(rawDir, { recursive: true });

  // ── Real inputs ────────────────────────────────────────────────────
  const fixtures = JSON.parse(
    fs.readFileSync(path.resolve('data/cache/oddspapi_pl_fixtures.json'), 'utf-8')
  ) as any[];
  const catalog = loadMarketCatalog(path.resolve('data/cache/oddspapi_markets_raw.json'));
  const aliases = loadTeamAliases(path.resolve('data/identity/team_aliases.json'));
  const leagueMap = loadLeagueMap(path.resolve('data/identity/league_map.json'));
  const canonical = loadCanonicalFixturesFromJsonl(path.resolve(CANONICAL_FILE), { leagueIds: ['ENG-PL'] });
  const canonicalById = new Map<string, CanonicalFixtureRef>(canonical.map((c) => [c.canonicalMatchId, c]));
  const engine = new FixtureMappingEngine(canonical, aliases);

  // One finished fixture per month, Feb–May 2026 (canonical season coverage).
  const months = ['2026-02', '2026-03', '2026-04', '2026-05'].slice(0, limit);
  const samples = months
    .map((month) =>
      fixtures
        .filter((f) => f.startTime.startsWith(month) && f.statusId === 2 && f.tournamentId === 17)
        .sort((a, b) => a.startTime.localeCompare(b.startTime))[0]
    )
    .filter(Boolean);

  const client = new NativeOddsClient();

  const report: any = {
    runId,
    generatedAt: new Date().toISOString(),
    config: { limit, bookmakers: BOOKMAKERS, canonicalFile: CANONICAL_FILE, months },
    providerRecords: { raw: 0, normalized: 0, invalidOddsSkipped: 0 },
    fixtures: { selected: samples.length, processed: 0, fetchFailures: [] as any[] },
    mapping: { MAPPED: 0, UNMAPPED: 0, AMBIGUOUS: 0, CONFLICT: 0, duplicateProviderEvents: 0 },
    markets: { total: 0, ready: 0, missingLine: 0, noValidObservations: 0, unsupported: 0 },
    selections: {
      entryValid: 0,
      closingValid: 0,
      bothValid: 0,
      singleObservation: 0,
      missingClosing: 0,
      entryAfterClosing: 0,
      invalidTimestamp: 0,
      closingAfterKickoffRejected: 0,
      outsideWindow: 0,
    },
    rowsBuilt: 0,
    rowsRejected: {} as Record<string, number>,
    partialBooks: { count: 0, detail: [] as any[] },
    clvReadiness: {
      matchesWithEntry: 0,
      matchesWithClosing: 0,
      matchesWithBoth: 0,
      matchesMissingClosing: 0,
      lineMismatch: 0,
      mappingFailure: 0,
    },
    bookmakerAvailability: null as any,
    dbWrites: {
      mapping: 'NOT_ATTEMPTED',
      odds: 'NOT_ATTEMPTED',
      matches: 'NOT_ATTEMPTED',
      detail: [] as string[],
    },
  };

  // Reuse the real coverage-matrix probe evidence if present.
  const matrixFile = path.resolve('data/historical/oddspapi/coverage_matrix_probe.json');
  if (fs.existsSync(matrixFile)) {
    const matrix = JSON.parse(fs.readFileSync(matrixFile, 'utf-8'));
    const availability: Record<string, Record<string, number>> = {};
    for (const r of matrix.results ?? []) {
      availability[r.bookmaker] = availability[r.bookmaker] ?? {};
      availability[r.bookmaker][String(r.status)] = (availability[r.bookmaker][String(r.status)] ?? 0) + 1;
    }
    report.bookmakerAvailability = availability;
  }

  const allDecisions: MappingDecision[] = [];
  const allRows: HistoricalOddsRow[] = [];

  for (const fixture of samples) {
    const kickoffMs = Date.parse(fixture.startTime);
    const leagueKey = leagueMap['oddspapi']?.[String(fixture.tournamentId)] ?? '';
    const decision = engine.map({
      provider: 'oddspapi',
      providerEventId: fixture.fixtureId,
      leagueKey,
      homeTeam: fixture.participant1Name,
      awayTeam: fixture.participant2Name,
      kickoffMs,
    });
    allDecisions.push(decision);
    report.mapping[decision.status] += 1;
    if (decision.status !== 'MAPPED') report.clvReadiness.mappingFailure += 1;

    let response: any;
    const rawFile = path.join(rawDir, `${fixture.fixtureId}_${BOOKMAKERS.join('-')}.json`);
    const reuseRaw = argValue('reuse-raw', '0') === '1';
    if (reuseRaw && fs.existsSync(rawFile)) {
      response = JSON.parse(fs.readFileSync(rawFile, 'utf-8'));
    } else {
      try {
        response = await client.fetchHistoricalOdds({ fixtureId: fixture.fixtureId, bookmakers: BOOKMAKERS });
      } catch (err: any) {
        const kind = err instanceof OddsPapiError ? err.kind : 'ERROR';
        const status = err instanceof OddsPapiError ? err.httpStatus ?? null : null;
        report.fixtures.fetchFailures.push({ fixtureId: fixture.fixtureId, kind, status });
        continue;
      }
      fs.writeFileSync(rawFile, JSON.stringify(response, null, 2), 'utf-8');
    }
    report.fixtures.processed += 1;

    const rawCount = countRawEntries(response);
    const normalized = normalizeHistoricalOdds(response);
    report.providerRecords.raw += rawCount;
    report.providerRecords.normalized += normalized.length;
    report.providerRecords.invalidOddsSkipped += Math.max(0, rawCount - normalized.length);

    const { sets, unsupportedMarketIds } = buildMarketObservationSets(normalized, catalog, kickoffMs);
    report.markets.total += sets.length;
    report.markets.unsupported += unsupportedMarketIds.length;

    let matchHasEntry = false;
    let matchHasClosing = false;

    for (const set of sets) {
      if (set.status === 'READY') report.markets.ready += 1;
      if (set.status === 'MISSING_LINE') report.markets.missingLine += 1;
      if (set.status === 'NO_VALID_OBSERVATIONS') report.markets.noValidObservations += 1;

      for (const selection of set.selections) {
        if (selection.entry) report.selections.entryValid += 1;
        if (selection.closing) report.selections.closingValid += 1;
        if (selection.entry && selection.closing) report.selections.bothValid += 1;
        if (selection.singleObservation) report.selections.singleObservation += 1;
        if (selection.entry && !selection.closing) report.selections.missingClosing += 1;
        if (selection.entryAfterClosing) report.selections.entryAfterClosing += 1;
        report.selections.invalidTimestamp += selection.invalidTimestamp;
        report.selections.closingAfterKickoffRejected += selection.closingAfterKickoffRejected;
        report.selections.outsideWindow += selection.outsideWindow;
        if (selection.entry) matchHasEntry = true;
        if (selection.closing) matchHasClosing = true;
      }

      if (decision.status !== 'MAPPED') continue;
      const canonicalRef = canonicalById.get(decision.canonicalMatchId!);
      if (!canonicalRef) continue;

      const built = buildHistoricalOddsRows({
        set,
        bookmaker: BOOKMAKERS[0],
        provider: 'oddspapi',
        providerEventId: fixture.fixtureId,
        canonicalId: canonicalRef.canonicalMatchId,
        leagueId: canonicalRef.leagueKey,
        cluster: canonicalRef.cluster ?? 'A',
        season: canonicalRef.season ?? '',
        matchDate: canonicalRef.kickoffDate,
        datasetVersion: 'oddspapi-historical-v1',
        ingestionVersion: 'increment2-v1',
      });
      allRows.push(...built.rows);
      report.partialBooks.count += built.partialBooks.length;
      if (report.partialBooks.detail.length < 20) {
        report.partialBooks.detail.push(...built.partialBooks.slice(0, 20 - report.partialBooks.detail.length));
      }
      for (const rejection of built.rejections) {
        increment(report.rowsRejected, rejection.reason);
        if (rejection.reason === 'LINE_MISSING') report.clvReadiness.lineMismatch += 1;
      }
    }

    if (decision.status === 'MAPPED') {
      if (matchHasEntry) report.clvReadiness.matchesWithEntry += 1;
      if (matchHasClosing) report.clvReadiness.matchesWithClosing += 1;
      if (matchHasEntry && matchHasClosing) report.clvReadiness.matchesWithBoth += 1;
      if (matchHasEntry && !matchHasClosing) report.clvReadiness.matchesMissingClosing += 1;
    }
  }

  report.rowsBuilt = allRows.length;
  report.mapping.duplicateProviderEvents = detectDuplicateProviderEvents(allDecisions).length;

  // ── Artifacts (always written) ─────────────────────────────────────
  fs.writeFileSync(
    path.join(outDir, 'mapping.jsonl'),
    allDecisions.map((d) => JSON.stringify(decisionToMappingRow(d))).join('\n') + '\n',
    'utf-8'
  );
  fs.writeFileSync(
    path.join(outDir, 'historical_odds_rows.jsonl'),
    allRows.map((r) => JSON.stringify(r)).join('\n') + (allRows.length ? '\n' : ''),
    'utf-8'
  );

  // ── DB writes (fail-closed, classified) ────────────────────────────
  if (supabaseUrl && serviceKey) {
    const mappingCap = await rest('/provider_fixture_map?select=provider_event_id&limit=1');
    const oddsCap = await rest('/historical_odds?select=provider,odds_timestamp&limit=1');
    const matchesCap = await rest('/historical_matches?select=canonical_id&limit=1');

    if (mappingCap.status === 200 && allDecisions.length > 0) {
      const res = await rest('/provider_fixture_map?on_conflict=provider,provider_event_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(allDecisions.map(decisionToMappingRow)),
      });
      report.dbWrites.mapping = res.status < 300 ? 'WRITTEN' : `FAILED:${res.status}:${JSON.stringify(res.body).slice(0, 160)}`;
    } else {
      report.dbWrites.mapping = mappingCap.status === 200 ? 'NOTHING_TO_WRITE' : `SKIPPED_TABLE_MISSING:${mappingCap.status}`;
    }

    if (oddsCap.status === 200 && allRows.length > 0) {
      // FK requires canonical matches to exist; upsert the REAL canonical rows
      // (full dataset values) for the mapped ids before inserting odds.
      if (matchesCap.status === 200) {
        const mappedIds = new Set(allRows.map((r) => r.canonical_id));
        const canonicalRows = fs
          .readFileSync(path.resolve(CANONICAL_FILE), 'utf-8')
          .split('\n')
          .filter(Boolean)
          .filter((l) => {
            try {
              return mappedIds.has(JSON.parse(l).canonicalId);
            } catch {
              return false;
            }
          })
          .map((l) => JSON.parse(l));

        const realMatchRows = canonicalRows.map((m: any) => ({
          canonical_id: m.canonicalId,
          league_id: m.leagueId,
          cluster: m.cluster,
          season: m.season,
          match_date: m.matchDate,
          home_team: m.homeTeam,
          away_team: m.awayTeam,
          home_goals: m.homeGoals,
          away_goals: m.awayGoals,
          result: m.result,
          result_verified: m.resultVerified,
          total_goals: m.totalGoals,
          home_win: m.homeWin,
          draw: m.draw,
          away_win: m.awayWin,
          btts: m.btts,
          over15: m.over15,
          over25: m.over25,
          over35: m.over35,
          under15: m.under15,
          under25: m.under25,
          under35: m.under35,
          source_provider: m.sourceProvider,
          source_file: m.sourceFile,
          source_row: m.sourceRow,
          normalization_version: m.normalizationVersion,
          schema_version: m.schemaVersion,
        }));

        const matchRes = await rest('/historical_matches?on_conflict=canonical_id', {
          method: 'POST',
          headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify(realMatchRows),
        });
        report.dbWrites.matches = matchRes.status < 300 ? 'WRITTEN' : `FAILED:${matchRes.status}:${JSON.stringify(matchRes.body).slice(0, 160)}`;
      } else {
        report.dbWrites.matches = `SKIPPED_TABLE_MISSING:${matchesCap.status}`;
      }

      const oddsRes = await rest('/historical_odds?on_conflict=odds_id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(allRows),
      });
      report.dbWrites.odds = oddsRes.status < 300 ? 'WRITTEN' : `FAILED:${oddsRes.status}:${JSON.stringify(oddsRes.body).slice(0, 200)}`;
    } else {
      report.dbWrites.odds = oddsCap.status === 200 ? 'NOTHING_TO_WRITE' : `SKIPPED_COLUMNS_MISSING:${oddsCap.status}`;
    }
  } else {
    report.dbWrites.detail.push('Supabase URL/service key not configured');
  }

  fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2), 'utf-8');

  console.log(JSON.stringify(report, null, 2));
  console.log(`\nartifacts: ${outDir}`);
}

run().catch((err) => {
  console.error('Ingestion runner crashed:', err.message);
  process.exitCode = 1;
});
