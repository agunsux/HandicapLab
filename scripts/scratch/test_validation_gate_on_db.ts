import * as fs from 'fs';
import * as path from 'path';
import { validateUpcomingPrediction, RejectionReason } from '../../src/lib/validation/predictionGate';

const timestamp = '2026-08-30T16-36-26-811Z';
const backupDir = path.resolve(process.cwd(), 'data', 'backups', `epic61_backup_${timestamp}`);

async function main() {
  console.log('=== TESTING VALIDATION GATE AGAINST CURRENT DATABASE TABLES ===');
  const now = new Date('2026-08-30T17:00:00Z');

  // 1. Test daily_picks (1,224 rows)
  const dailyPicksPath = path.join(backupDir, 'daily_picks.json');
  const dailyPicks: any[] = JSON.parse(fs.readFileSync(dailyPicksPath, 'utf8'));

  const dailyPicksRejections: Record<RejectionReason, number> = {
    FIXTURE_ALREADY_PLAYED: 0,
    MOCK_OR_MISSING_PROVIDER_ID: 0,
    INVALID_OR_MISSING_KICKOFF: 0,
    INVALID_STATUS: 0,
    INVALID_MARKET: 0,
    MISSING_REAL_ODDS: 0,
    MISSING_TEAMS: 0,
    MISSING_MODEL_OUTPUT: 0
  };

  let dailyPicksPassed = 0;
  let livEveTotal = 0;
  let livEvePassed = 0;
  const livEveRejectionReasons: Record<string, number> = {};

  for (const pick of dailyPicks) {
    const isLivEve =
      (pick.home_team && (pick.home_team.includes('Liverpool') || pick.home_team.includes('Everton'))) ||
      (pick.away_team && (pick.away_team.includes('Liverpool') || pick.away_team.includes('Everton')));

    if (isLivEve) livEveTotal++;

    const res = validateUpcomingPrediction({
      id: pick.id,
      fixtureId: pick.fixture_id,
      homeTeam: pick.home_team,
      awayTeam: pick.away_team,
      kickoffTime: pick.kickoff_utc,
      status: pick.status,
      market: pick.market_type,
      odds: pick.market_odds,
      isSynthetic: pick.source === 'mock' || String(pick.id).startsWith('mock-')
    }, now);

    if (res.isValid) {
      dailyPicksPassed++;
      if (isLivEve) livEvePassed++;
    } else if (res.rejectionReason) {
      dailyPicksRejections[res.rejectionReason]++;
      if (isLivEve) {
        livEveRejectionReasons[res.rejectionReason] = (livEveRejectionReasons[res.rejectionReason] || 0) + 1;
      }
    }
  }

  console.log(`\nDaily Picks Scanned: ${dailyPicks.length}`);
  console.log(`Passed Quality Gate: ${dailyPicksPassed}`);
  console.log(`Rejected Count: ${dailyPicks.length - dailyPicksPassed}`);
  console.log('Rejection Breakdown:', dailyPicksRejections);
  console.log(`\nLiverpool/Everton Records in Daily Picks: ${livEveTotal}`);
  console.log(`Liverpool/Everton Passed Gate: ${livEvePassed}`);
  console.log('Liverpool/Everton Rejection Breakdown:', livEveRejectionReasons);

  fs.writeFileSync(
    path.resolve(process.cwd(), 'reports', 'STAGE_C_GATE_TEST_REPORT.json'),
    JSON.stringify({
      timestamp: new Date().toISOString(),
      totalScanned: dailyPicks.length,
      passedCount: dailyPicksPassed,
      rejectedCount: dailyPicks.length - dailyPicksPassed,
      rejectionBreakdown: dailyPicksRejections,
      liverpoolEverton: {
        total: livEveTotal,
        passed: livEvePassed,
        rejected: livEveTotal - livEvePassed,
        reasons: livEveRejectionReasons
      }
    }, null, 2),
    'utf8'
  );
}

main().catch(console.error);
