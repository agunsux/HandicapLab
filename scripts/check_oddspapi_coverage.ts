import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';
dotenv.config({ path: '.env.local' });

const key = process.env.ODDS_PAPI_KEY || process.env.ODDSPAPI_KEY;

async function checkOddsPapiCoverage() {
  const cacheDir = path.resolve('data/cache');
  if (!fs.existsSync(cacheDir)) fs.mkdirSync(cacheDir, { recursive: true });
  const cacheFile = path.join(cacheDir, 'oddspapi_pl_fixtures.json');

  let fixtures: any[] = [];
  if (fs.existsSync(cacheFile)) {
    console.log('Using cached Premier League fixtures...');
    fixtures = JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  } else {
    console.log('Fetching Premier League finished fixtures (1 billable request)...');
    const res = await fetch(`https://api.oddspapi.io/v4/fixtures?apiKey=${key}&tournamentId=17&statusId=2`);
    if (!res.ok) {
      console.error('Failed to fetch fixtures:', res.status, await res.text());
      return;
    }
    fixtures = await res.json();
    fs.writeFileSync(cacheFile, JSON.stringify(fixtures, null, 2));
    console.log(`Saved ${fixtures.length} fixtures to ${cacheFile}`);
  }

  // Sort by startTime
  fixtures.sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  console.log(`Total fixtures: ${fixtures.length}`);
  console.log(`Range: ${fixtures[0].startTime} to ${fixtures[fixtures.length - 1].startTime}`);

  // Sample fixtures across time buckets:
  // 1. 2024-H2 (Aug 2024 - Dec 2024)
  // 2. 2025-H1 (Jan 2025 - May 2025)
  // 3. 2025-H2 (Aug 2025 - Dec 2025)
  // 4. 2026-Jan/Feb
  // 5. 2026-H1 (Mar 2026 - May 2026)
  // 6. 2026-H2 (Aug 2026)
  const buckets: { [label: string]: any } = {};
  for (const f of fixtures) {
    const d = f.startTime.slice(0, 7); // YYYY-MM
    if (!buckets[d]) buckets[d] = f;
  }

  console.log('\nProbing historical odds across available months (Free endpoint):');
  const results: { month: string; fixtureId: string; status: number; hasOdds: boolean }[] = [];

  for (const month of Object.keys(buckets).sort()) {
    const sample = buckets[month];
    const url = `https://api.oddspapi.io/v4/historical-odds?apiKey=${key}&fixtureId=${sample.fixtureId}&bookmakers=pinnacle`;
    try {
      const res = await fetch(url);
      const ok = res.ok;
      results.push({
        month,
        fixtureId: sample.fixtureId,
        status: res.status,
        hasOdds: ok
      });
      console.log(`Month ${month}: Status ${res.status} (${ok ? 'FOUND' : 'NOT FOUND'}) - Match: ${sample.participant1ShortName} vs ${sample.participant2ShortName}`);
      // Respect 5000ms cooldown as per documentation
      await new Promise(r => setTimeout(r, 5100));
    } catch (e: any) {
      console.error(`Error probing ${month}:`, e.message);
    }
  }

  console.log('\n=== OddsPAPI Historical Coverage Summary ===');
  console.table(results);

  // Check quota
  const qRes = await fetch(`https://api.oddspapi.io/v4/account?apiKey=${key}`);
  const qData = await qRes.json();
  const sub = qData.subscriptions?.[0] || {};
  console.log(`Final Quota: ${sub.request_count} / ${sub.request_limit} (Remaining: ${sub.request_limit - sub.request_count})`);
}

checkOddsPapiCoverage().catch(console.error);
