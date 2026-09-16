import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { FootyStatsResearchClient } from '../../src/lib/research/prematch-yield/footystatsClient';
import { normalizeMatchOdds } from '../../src/lib/research/prematch-yield/normalizer';
import {
  NormalizedProxyOddsRecord,
  FootyStatsCoverageOutput,
  SeasonCoverageReport,
  RawFootyStatsMatch,
} from '../../src/lib/research/prematch-yield/types';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const PILOT_SEASONS = [
  { seasonId: 12325, label: '2024-2025', description: 'EPL 2024/2025' },
  { seasonId: 15050, label: '2025-2026', description: 'EPL 2025/2026' },
];

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

  console.log(`[Checksum Verify] matchesHash:  ${matchesHash}`);
  console.log(`[Checksum Verify] oddsHash:     ${oddsHash}`);
  console.log(`[Checksum Verify] combinedHash: ${combinedHash}`);

  if (combinedHash !== FROZEN_COMBINED_CHECKSUM) {
    throw new Error(
      `[GATE_GG_VIOLATION] Frozen gold checksum mismatch! Expected ${FROZEN_COMBINED_CHECKSUM}, got ${combinedHash}`
    );
  }
  return true;
}

async function runPilotIngestion() {
  console.log('================================================================');
  console.log('SALMO.DEV — CONTROLLED 2-SEASON EPL PILOT (TASK 2 & TASK 3)');
  console.log('================================================================\n');

  // Step 0: Verify initial gold dataset integrity (Gate G-G)
  verifyFrozenGoldChecksum();
  console.log('[Gate G-G] Initial dataset checksum: VERIFIED PASS\n');

  const rawKey = process.env.FOOTYSTATS_API_KEY;
  if (!rawKey || !rawKey.trim()) {
    console.error('[GATE_GA_ERROR] FOOTYSTATS_API_KEY not found in .env');
    process.exit(1);
  }

  // Client configured with strict max pilot budget = 2 requests
  const client = new FootyStatsResearchClient({
    maxPilotNetworkRequests: 2,
  });

  let apiFootballRequestsThisRun = 0;
  let oddsPapiRequestsThisRun = 0;

  const rawCacheDir = path.resolve(process.cwd(), 'data/raw/footystats/epl');
  const proxyOutDir = path.resolve(process.cwd(), 'data/golden/proxy');
  const verificationDir = path.resolve(process.cwd(), 'data/verification');

  if (!fs.existsSync(proxyOutDir)) {
    fs.mkdirSync(proxyOutDir, { recursive: true });
  }
  if (!fs.existsSync(verificationDir)) {
    fs.mkdirSync(verificationDir, { recursive: true });
  }

  const allNormalizedRecords: NormalizedProxyOddsRecord[] = [];
  const seasonReports: Record<string, SeasonCoverageReport> = {};

  let totalPilotFixtures = 0;
  let totalBttsQuotedFixtures = 0;
  const normalizationCountsByMarket: Record<string, number> = {
    '1X2': 0,
    'BTTS': 0,
    'OU': 0,
    'CS_A': 0,
    'CS_B': 0,
  };

  for (const seasonConfig of PILOT_SEASONS) {
    console.log(`--- Processing ${seasonConfig.description} (season_id: ${seasonConfig.seasonId}) ---`);
    const result = await client.getSeasonMatches(seasonConfig.seasonId, seasonConfig.label);
    const matches: RawFootyStatsMatch[] = result.payload.data;
    const fixtureCount = matches.length;
    totalPilotFixtures += fixtureCount;

    let completedFixtureCount = 0;
    let scoresValidCount = 0;
    let odds1x2QuotedCount = 0;
    let oddsBttsQuotedCount = 0;
    let oddsOu25QuotedCount = 0;
    let oddsOuOtherQuotedCount = 0;
    let oddsCsQuotedCount = 0;

    matches.forEach((m, idx) => {
      if (m.status === 'complete') {
        completedFixtureCount++;
      }
      if (
        m.homeGoalCount !== null &&
        m.homeGoalCount !== undefined &&
        m.awayGoalCount !== null &&
        m.awayGoalCount !== undefined &&
        m.homeGoalCount >= 0 &&
        m.awayGoalCount >= 0
      ) {
        scoresValidCount++;
      }

      // Check 1X2
      const h = typeof m.odds_ft_1 === 'number' ? m.odds_ft_1 : parseFloat(String(m.odds_ft_1));
      const x = typeof m.odds_ft_x === 'number' ? m.odds_ft_x : parseFloat(String(m.odds_ft_x));
      const a = typeof m.odds_ft_2 === 'number' ? m.odds_ft_2 : parseFloat(String(m.odds_ft_2));
      if (!isNaN(h) && h > 1 && !isNaN(x) && x > 1 && !isNaN(a) && a > 1) {
        odds1x2QuotedCount++;
      }

      // Check BTTS
      const by = typeof m.odds_btts_yes === 'number' ? m.odds_btts_yes : parseFloat(String(m.odds_btts_yes));
      const bn = typeof m.odds_btts_no === 'number' ? m.odds_btts_no : parseFloat(String(m.odds_btts_no));
      if (!isNaN(by) && by > 1 && !isNaN(bn) && bn > 1) {
        oddsBttsQuotedCount++;
      }

      // Check OU 2.5
      const o25 = typeof m.odds_ft_over25 === 'number' ? m.odds_ft_over25 : parseFloat(String(m.odds_ft_over25));
      const u25 = typeof m.odds_ft_under25 === 'number' ? m.odds_ft_under25 : parseFloat(String(m.odds_ft_under25));
      if (!isNaN(o25) && o25 > 1 && !isNaN(u25) && u25 > 1) {
        oddsOu25QuotedCount++;
      }

      // Check OU other lines
      const otherOuValues = [
        m.odds_ft_over05, m.odds_ft_under05,
        m.odds_ft_over15, m.odds_ft_under15,
        m.odds_ft_over35, m.odds_ft_under35,
        m.odds_ft_over45, m.odds_ft_under45,
      ];
      const hasOtherOu = otherOuValues.some((v) => {
        const parsed = typeof v === 'number' ? v : parseFloat(String(v));
        return !isNaN(parsed) && parsed > 1;
      });
      if (hasOtherOu) {
        oddsOuOtherQuotedCount++;
      }

      // Check CS
      const csValues = [
        m.odds_team_a_cs_yes, m.odds_team_a_cs_no,
        m.odds_team_b_cs_yes, m.odds_team_b_cs_no,
      ];
      const hasCs = csValues.some((v) => {
        const parsed = typeof v === 'number' ? v : parseFloat(String(v));
        return !isNaN(parsed) && parsed > 1;
      });
      if (hasCs) {
        oddsCsQuotedCount++;
      }

      // Normalize match odds
      const normalizedRows = normalizeMatchOdds(
        m,
        seasonConfig.label,
        path.relative(process.cwd(), result.cachePath),
        idx
      );
      for (const row of normalizedRows) {
        allNormalizedRecords.push(row);
        normalizationCountsByMarket[row.market] = (normalizationCountsByMarket[row.market] || 0) + 1;
      }
    });

    totalBttsQuotedFixtures += oddsBttsQuotedCount;

    const report: SeasonCoverageReport = {
      season: seasonConfig.label,
      seasonId: seasonConfig.seasonId,
      fromCache: result.fromCache,
      fixtureCount,
      completedFixtureCount,
      statusMessage: result.payload.message || (fixtureCount === 0 ? 'No fixtures returned' : 'OK'),
      fields: {
        scoresValidCount,
        scoresValidPct: fixtureCount > 0 ? Math.round((scoresValidCount / fixtureCount) * 10000) / 100 : 0,
        odds1x2QuotedCount,
        odds1x2FillRatePct: fixtureCount > 0 ? Math.round((odds1x2QuotedCount / fixtureCount) * 10000) / 100 : 0,
        oddsBttsQuotedCount,
        oddsBttsFillRatePct: fixtureCount > 0 ? Math.round((oddsBttsQuotedCount / fixtureCount) * 10000) / 100 : 0,
        oddsOu25QuotedCount,
        oddsOu25FillRatePct: fixtureCount > 0 ? Math.round((oddsOu25QuotedCount / fixtureCount) * 10000) / 100 : 0,
        oddsOuOtherQuotedCount,
        oddsCsQuotedCount,
      },
    };

    seasonReports[seasonConfig.label] = report;
    console.log(`  Fixtures: ${fixtureCount} (Completed: ${completedFixtureCount})`);
    console.log(`  BTTS Quoted: ${oddsBttsQuotedCount}/${fixtureCount} (${report.fields.oddsBttsFillRatePct}%)`);
    console.log(`  OU 2.5 Quoted: ${oddsOu25QuotedCount}/${fixtureCount} (${report.fields.oddsOu25FillRatePct}%)`);
    console.log(`  1X2 Quoted: ${odds1x2QuotedCount}/${fixtureCount} (${report.fields.odds1x2FillRatePct}%)\n`);
  }

  // 1. Write normalized odds to JSONL
  const proxyOddsFile = path.join(proxyOutDir, 'footystats_epl_odds.jsonl');
  const jsonlLines = allNormalizedRecords.map((r) => JSON.stringify(r)).join('\n') + '\n';
  fs.writeFileSync(proxyOddsFile, jsonlLines, 'utf-8');
  console.log(`[Normalization] Written ${allNormalizedRecords.length} proxy odds rows to ${proxyOddsFile}`);

  // 2. Evaluate Gate G-D
  const aggregateBttsFillPct =
    totalPilotFixtures > 0
      ? Math.round((totalBttsQuotedFixtures / totalPilotFixtures) * 10000) / 100
      : 0;

  const gateGDStatus = aggregateBttsFillPct >= 80.0 ? 'PASS' : 'BLOCKED';

  // 3. Emit FOOTYSTATS_COVERAGE.json
  const coverageOutput: FootyStatsCoverageOutput = {
    generatedAt: new Date().toISOString(),
    pilotScope: PILOT_SEASONS.map((s) => s.label),
    gateGD: {
      targetMetric: 'odds_btts_yes/no fill rate on EPL matched fixtures >= 80%',
      thresholdPct: 80.0,
      actualPct: aggregateBttsFillPct,
      status: gateGDStatus,
    },
    providerAudit: {
      footystatsRequestsThisRun: client.getNetworkRequestsIssued(),
      apiFootballRequestsThisRun: 0,
      oddsPapiRequestsThisRun: 0,
    },
    seasons: seasonReports,
    normalizationSummary: {
      totalNormalizedOddsRows: allNormalizedRecords.length,
      byMarket: normalizationCountsByMarket,
    },
  };

  const coverageFile = path.join(verificationDir, 'FOOTYSTATS_COVERAGE.json');
  fs.writeFileSync(coverageFile, JSON.stringify(coverageOutput, null, 2), 'utf-8');
  console.log(`[Verification] Written coverage report to ${coverageFile}\n`);

  // Step 4: Verify post-run gold dataset integrity (Gate G-G)
  verifyFrozenGoldChecksum();
  console.log('[Gate G-G] Post-run dataset checksum: VERIFIED PASS (0 mutation)');

  console.log('\n================================================================');
  console.log('PILOT SUMMARY AUDIT');
  console.log('================================================================');
  console.log(JSON.stringify(coverageOutput, null, 2));
}

runPilotIngestion().catch((err) => {
  console.error('[PILOT_EXECUTION_FATAL_ERROR]', err);
  process.exit(1);
});
