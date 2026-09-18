import { DailyPicksEngine } from '../lib/daily-picks/engine';

async function main() {
  console.log('[PROBE] Running DailyPicksEngine.generateAndPersistDailyPicks()...');
  const res = await DailyPicksEngine.generateAndPersistDailyPicks({ forceRefresh: true });
  console.log('[PROBE] Stats:', res.stats);
  console.log('[PROBE] Discovered matches:', res.matches.length);
  console.log('[PROBE] Qualified picks:', res.picks.length);
  if (res.picks.length > 0) {
    console.log('[PROBE] Top pick:', {
      predictionId: res.picks[0].predictionId,
      fixtureId: res.picks[0].fixtureId,
      match: `${res.picks[0].homeTeam} vs ${res.picks[0].awayTeam}`,
      market: res.picks[0].market,
      selection: res.picks[0].selection,
      fairOdds: res.picks[0].fairOdds,
      marketOdds: res.picks[0].marketOdds,
      edge: (res.picks[0].edge * 100).toFixed(2) + '%',
      ev: (res.picks[0].expectedValue * 100).toFixed(2) + '%',
      bookmaker: 'Pinnacle',
      provenance: res.picks[0].oddsPapiSnapshotTimestamp
    });
  }
}

main().catch(err => {
  console.error('[PROBE] Failed:', err);
  process.exit(1);
});
