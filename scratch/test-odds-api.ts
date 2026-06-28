import 'dotenv/config';
import { oddsApiClient } from '../src/lib/apis/oddspapi';

async function main() {
  console.log('Fetching odds from Odds API for soccer_fifa_world_cup...');
  try {
    const odds = await oddsApiClient.getOdds('soccer_fifa_world_cup');
    console.log(`Fetched ${odds.length} odds objects.`);
    console.log('Sample matches from Odds API:');
    odds.forEach((o, i) => {
      console.log(`[${i + 1}] Home: ${o.home_team} | Away: ${o.away_team} | Commence: ${o.commence_time}`);
    });
  } catch (e) {
    console.error('Odds API error:', e);
  }
}

main();
