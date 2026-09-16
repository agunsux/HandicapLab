import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';
import * as crypto from 'crypto';
import {
  joinFixtures,
  CanonicalGoldMatch,
  MatchCandidate,
  JoinResult,
} from '../../src/lib/research/prematch-yield/teamMapping';
import {
  runProvenanceAudit,
  PairedFixtureOdds,
  ProvenanceAuditReport,
} from '../../src/lib/research/prematch-yield/provenanceAudit';
import { parseOddsValue } from '../../src/lib/research/prematch-yield/footystatsClient';

const FROZEN_COMBINED_CHECKSUM = '22e8e80a8d9c53aa878972bc42603d9b231fed709357c9d05cf8defc1ac1d727';

function computeSha256(filePath: string): string {
  const content = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(content).digest('hex');
}

function verifyFrozenGoldChecksum(): boolean {
  const matchesPath = path.resolve(process.cwd(), 'data/golden/europe/canonical_matches.jsonl');
  const oddsPath = path.resolve(process.cwd(), 'data/golden/europe/market_odds.jsonl');

  const matchesHash = computeSha256(matchesPath);
  const oddsHash = computeSha256(oddsPath);
  const combinedHash = crypto
    .createHash('sha256')
    .update(matchesHash.toLowerCase() + oddsHash.toLowerCase())
    .digest('hex');

  if (combinedHash !== FROZEN_COMBINED_CHECKSUM) {
    throw new Error(
      `[GATE_GG_VIOLATION] Frozen gold checksum mismatch! Expected ${FROZEN_COMBINED_CHECKSUM}, got ${combinedHash}`
    );
  }
  return true;
}

async function loadGoldMatches(seasonLabel: string): Promise<CanonicalGoldMatch[]> {
  const filePath = path.resolve(process.cwd(), 'data/golden/europe/canonical_matches.jsonl');
  const rl = readline.createInterface({ input: fs.createReadStream(filePath) });
  const matches: CanonicalGoldMatch[] = [];

  for await (const line of rl) {
    if (!line.trim()) continue;
    const obj = JSON.parse(line);
    if (obj.leagueId === 'ENG-PL' && obj.season === seasonLabel) {
      matches.push({
        canonicalId: obj.canonicalId,
        leagueId: obj.leagueId,
        season: obj.season,
        matchDate: obj.matchDate,
        homeTeam: obj.homeTeam,
        awayTeam: obj.awayTeam,
        homeGoals: obj.homeGoals,
        awayGoals: obj.awayGoals,
        resultVerified: obj.resultVerified,
      });
    }
  }
  return matches;
}

interface PinnacleOddsMap {
  [canonicalId: string]: {
    mlOpening?: { home: number; draw: number; away: number };
    mlClosing?: { home: number; draw: number; away: number };
    ouOpening?: { over: number; under: number };
    ouClosing?: { over: number; under: number };
  };
}

async function loadGoldPinnacleOdds(seasonLabel: string): Promise<PinnacleOddsMap> {
  const filePath = path.resolve(process.cwd(), 'data/golden/europe/market_odds.jsonl');
  const rl = readline.createInterface({ input: fs.createReadStream(filePath) });
  const oddsMap: PinnacleOddsMap = {};

  for await (const line of rl) {
    if (!line.trim()) continue;
    const obj = JSON.parse(line);
    if (obj.league_id === 'ENG-PL' && obj.season === seasonLabel && obj.bookmaker_source === 'pinnacle') {
      if (!oddsMap[obj.canonical_id]) {
        oddsMap[obj.canonical_id] = {};
      }
      const entry = oddsMap[obj.canonical_id];

      if (obj.market === 'ML') {
        const mlQuotes = {
          home: obj.home_odds,
          draw: obj.draw_odds,
          away: obj.away_odds,
        };
        if (obj.observation === 'opening') entry.mlOpening = mlQuotes;
        else if (obj.observation === 'closing') entry.mlClosing = mlQuotes;
      } else if (obj.market === 'OU' && obj.line === 2.5) {
        const ouQuotes = {
          over: obj.over_odds,
          under: obj.under_odds,
        };
        if (obj.observation === 'opening') entry.ouOpening = ouQuotes;
        else if (obj.observation === 'closing') entry.ouClosing = ouQuotes;
      }
    }
  }
  return oddsMap;
}

async function runProvenanceAuditWorkflow() {
  console.log('================================================================');
  console.log('SALMO.DEV — TASK 4 (ENTITY JOIN) & TASK 5 (PROVENANCE AUDIT)');
  console.log('================================================================\n');

  // Pre-execution integrity check
  verifyFrozenGoldChecksum();
  console.log('[Gate G-G] Pre-run dataset checksum: VERIFIED PASS (22e8e80a8d9c53...)\n');

  const seasonLabel = '2024-2025';
  const rawCacheFile = path.resolve(process.cwd(), `data/raw/footystats/epl/${seasonLabel}.json`);

  if (!fs.existsSync(rawCacheFile)) {
    throw new Error(`[DATA_MISSING] Cached FootyStats season file not found: ${rawCacheFile}`);
  }

  const rawPayload = JSON.parse(fs.readFileSync(rawCacheFile, 'utf-8'));
  const footyMatches: any[] = rawPayload.data;
  console.log(`[Input Data] Loaded ${footyMatches.length} FootyStats matches from disk cache.`);

  // Load canonical gold
  const goldMatches = await loadGoldMatches(seasonLabel);
  console.log(`[Input Data] Loaded ${goldMatches.length} Canonical Gold EPL matches.`);

  // --------------------------------------------------------------------------
  // TASK 4: Entity Mapping & Fixture Join
  // --------------------------------------------------------------------------
  console.log('\n--- EXECUTING TASK 4: CANONICAL FIXTURE JOIN ---');
  const candidates: MatchCandidate[] = footyMatches.map((m) => ({
    id: m.id,
    home_name: m.home_name,
    away_name: m.away_name,
    date_unix: m.date_unix,
    status: m.status,
  }));

  const joinResult: JoinResult = joinFixtures(candidates, goldMatches, seasonLabel);

  console.log(`Canonical EPL Fixtures:  ${joinResult.canonicalEplFixtureCount}`);
  console.log(`FootyStats Fixtures:     ${joinResult.footystatsFixtureCount}`);
  console.log(`Successful Joins:        ${joinResult.successfulJoinCount}`);
  console.log(`Join Rate:               ${joinResult.joinRatePct}%`);
  console.log(`Unmatched FootyStats:    ${joinResult.unmatchedFootyStats.length}`);
  console.log(`Unmatched Gold:          ${joinResult.unmatchedGold.length}`);
  console.log(`Ambiguous Matches:       ${joinResult.ambiguousMatches.length}`);
  console.log(`Gate G-C Status:         ${joinResult.joinRatePct >= 95.0 ? 'PASS' : 'BLOCKED'}`);

  const verificationDir = path.resolve(process.cwd(), 'data/verification');
  if (!fs.existsSync(verificationDir)) fs.mkdirSync(verificationDir, { recursive: true });

  const joinReportPath = path.join(verificationDir, 'FOOTYSTATS_JOIN_REPORT.json');
  fs.writeFileSync(
    joinReportPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        season: seasonLabel,
        gateGC: {
          targetMetric: 'EPL team join rate FootyStats ↔ Gold >= 95%',
          thresholdPct: 95.0,
          actualPct: joinResult.joinRatePct,
          status: joinResult.joinRatePct >= 95.0 ? 'PASS' : 'BLOCKED',
        },
        joinResult,
      },
      null,
      2
    ),
    'utf-8'
  );
  console.log(`[Task 4] Saved join report to ${joinReportPath}`);

  // --------------------------------------------------------------------------
  // TASK 5: Provenance Audit (FootyStats vs Pinnacle Gold)
  // --------------------------------------------------------------------------
  console.log('\n--- EXECUTING TASK 5: FOOTYSTATS PROVENANCE AUDIT ---');
  const pinnacleOddsMap = await loadGoldPinnacleOdds(seasonLabel);
  console.log(`[Input Data] Loaded Pinnacle odds records for ${Object.keys(pinnacleOddsMap).length} canonical fixtures.`);

  // Build paired fixture odds array
  const pairedFixtures: PairedFixtureOdds[] = [];
  const footyMatchMap = new Map<number, any>();
  footyMatches.forEach((m) => footyMatchMap.set(m.id, m));

  for (const pair of joinResult.pairs) {
    const f = footyMatchMap.get(pair.footyId);
    if (!f) continue;
    const pin = pinnacleOddsMap[pair.canonicalId] || {};

    pairedFixtures.push({
      canonicalId: pair.canonicalId,
      matchDate: pair.matchDate,
      homeTeam: pair.home,
      awayTeam: pair.away,
      footy: {
        odds_ft_1: parseOddsValue(f.odds_ft_1),
        odds_ft_x: parseOddsValue(f.odds_ft_x),
        odds_ft_2: parseOddsValue(f.odds_ft_2),
        odds_ft_over25: parseOddsValue(f.odds_ft_over25),
        odds_ft_under25: parseOddsValue(f.odds_ft_under25),
        odds_btts_yes: parseOddsValue(f.odds_btts_yes),
        odds_btts_no: parseOddsValue(f.odds_btts_no),
      },
      pinnacle: pin,
    });
  }

  const provenanceReport: ProvenanceAuditReport = runProvenanceAudit(pairedFixtures, seasonLabel);

  const provenanceReportPath = path.join(verificationDir, 'FOOTYSTATS_PROVENANCE_AUDIT.json');
  fs.writeFileSync(provenanceReportPath, JSON.stringify(provenanceReport, null, 2), 'utf-8');
  console.log(`[Task 5] Saved provenance audit report to ${provenanceReportPath}\n`);

  // Post-execution integrity check
  verifyFrozenGoldChecksum();
  console.log('[Gate G-G] Post-run dataset checksum: VERIFIED PASS (0 mutation)\n');

  console.log('================================================================');
  console.log('PROVENANCE AUDIT SUMMARY REPORT');
  console.log('================================================================');
  console.log(JSON.stringify(provenanceReport, null, 2));
}

runProvenanceAuditWorkflow().catch((err) => {
  console.error('[PROVENANCE_AUDIT_FATAL_ERROR]', err);
  process.exit(1);
});

