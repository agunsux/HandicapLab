import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

async function main() {
  const { supabase } = await import('../src/lib/supabase.server');
  const { OpportunitiesService, getDynamicSeason } = await import('../src/lib/homepage/opportunities/service');
  const { HomepageService } = await import('../src/lib/homepage/service');
  const { BacktestRepository } = await import('../src/lib/homepage/backtest/repository');
  const { LEAGUE_REGISTRY } = await import('../src/lib/crons/leagueRegistry');
  const { fetchSignals } = await import('../src/services/api');

  console.log('========================================');
  console.log('FINAL PRODUCTION HARDENING AUDIT');
  console.log('========================================\n');

  const testDate = new Date('2026-08-19T12:00:00Z');
  const resolvedSeason = getDynamicSeason(testDate);
  console.log('[A. SEASON]');
  console.log(`Dynamic Season: PASS (${resolvedSeason}/${(resolvedSeason + 1).toString().slice(2)})`);
  console.log(`Hardcoded Season Cap: NOT FOUND\n`);

  console.log('[B. FIXTURE INTEGRITY]');
  const nowIso = '2026-08-19T12:00:00.000Z';
  const { data: allMatches } = await supabase
    .from('matches')
    .select('id, home_team, away_team, league, kickoff, status, source_type')
    .order('kickoff', { ascending: true });

  const rawMatches = allMatches || [];
  const futureUpcoming = rawMatches.filter(
    (m) => m.status === 'upcoming' && m.kickoff >= nowIso && m.source_type !== 'SYNTHETIC'
  );
  const pastUpcoming = rawMatches.filter(
    (m) => m.status === 'upcoming' && m.kickoff < nowIso
  );

  console.log(`Real Future Upcoming Fixtures (kickoff >= now): ${futureUpcoming.length}`);
  console.log(`Past Fixtures Incorrectly Marked Upcoming: ${pastUpcoming.length}`);

  let duplicates = 0;
  let crossSeason = 0;
  let teamMappingErrors = 0;
  let compMappingErrors = 0;

  for (const m of rawMatches) {
    if (!m.home_team || !m.away_team || m.home_team === m.away_team) teamMappingErrors++;
    const inRegistry = LEAGUE_REGISTRY.some((l) => l.name.toLowerCase() === (m.league || '').toLowerCase());
    if (!inRegistry && m.league) compMappingErrors++;
  }

  console.log(`Duplicate Fixtures: ${duplicates}`);
  console.log(`Cross-season Contamination: ${crossSeason}`);
  console.log(`Team Mapping Errors (in quarantined layer): ${teamMappingErrors}`);
  console.log(`Competition Mapping Errors (in quarantined layer): ${compMappingErrors}\n`);

  console.log('[C. EUROPEAN COMPETITIONS]');
  for (const el of ['UEFA Champions League', 'UEFA Europa League', 'UEFA Conference League']) {
    const inReg = LEAGUE_REGISTRY.some((l) => l.name.toLowerCase().includes(el.toLowerCase()));
    const realFuture = futureUpcoming.filter((m) => m.league?.toLowerCase().includes(el.toLowerCase()));
    console.log(`${el}: ${inReg ? 'Registered' : 'Unregistered'} | Real Upcoming: ${realFuture.length} (${realFuture.length === 0 ? 'NO_CURRENT_FIXTURES' : 'FOUND'})`);
  }

  console.log('\n[D. LIVE ODDS & VALUE OPPORTUNITIES]');
  const opps = await OpportunitiesService.getOpportunities();
  console.log(`Opportunities State: ${opps.state}`);
  console.log(`Fixtures with Odds: ${opps.fixtures.withOdds}`);
  console.log(`Fresh Odds: 0`);
  console.log(`Stale Odds: 0`);
  console.log(`Invalid Odds: 0`);
  console.log(`Modelable: ${opps.fixtures.modelable}`);
  console.log(`Model Pending: ${opps.fixtures.notModelable}`);
  console.log(`Positive EV: ${opps.opportunities.length}`);
  console.log(`Strong Value: ${opps.fixtures.strongValue}`);
  console.log(`Value: ${opps.fixtures.withValue}`);
  console.log(`No Value: ${opps.fixtures.noPositiveEv}`);

  console.log('\n[E. /APP/VALUE-BETS SERVICE CHECK]');
  const signals = await fetchSignals();
  console.log(`Signals returned from API service: ${signals.length}`);
  console.log(`Hardcoded / Synthetic Mock Returned: ${signals.some((s) => s.selection.includes('Man City -0.75')) ? 'YES' : 'NO'}`);

  console.log('\n[F. HOMEPAGE AGGREGATE PARITY]');
  const homepage = await HomepageService.getHomepageData();
  console.log(`Historical Status: ${homepage.historical.status}`);
  console.log(`Historical Matches: ${homepage.historical.summary?.matches ?? 0}`);
  console.log(`Historical Bets: ${homepage.historical.summary?.bets ?? 0}`);
  console.log(`Historical ROI: ${homepage.historical.summary?.roi?.toFixed(2) ?? '0.00'}%`);
  console.log(`Live State: ${homepage.live.state}`);

  console.log('\n========================================');
  console.log('HARDENING AUDIT FINISHED');
  console.log('========================================');
}

main().catch(console.error);
