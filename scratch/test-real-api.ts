import { apiFootballClient } from '../src/lib/apis/apifootball';
import 'dotenv/config';

// Canonical path only: this diagnostic goes through the quota-aware client so it
// is deduplicated, rate-limited and quota-accounted like production traffic.
// It must never issue a raw fetch or print the API key.

async function main() {
  console.log('Fetching fixtures through the canonical API-Football client...');
  try {
    const envelope = await apiFootballClient.getFixtures(1, 2026);
    const fixtures = envelope.response || [];
    console.log(`Fetched ${fixtures.length} fixtures through the canonical gateway.`);

    const rounds: Record<string, number> = {};
    fixtures.forEach((f: any) => {
      const round = f.league?.round ?? 'unknown';
      rounds[round] = (rounds[round] || 0) + 1;
    });
    console.log('Rounds in response:', rounds);

    console.log('Sample of matches:');
    console.log(
      fixtures.slice(0, 5).map((f: any) => ({
        id: f.fixture.id,
        round: f.league.round,
        home: f.teams.home.name,
        away: f.teams.away.name,
        date: f.fixture.date,
      }))
    );
  } catch (e: any) {
    console.error(`Fetch error: ${e?.message || e}`);
  }
}

main();
