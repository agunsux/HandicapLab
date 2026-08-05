import fs from 'fs';
import { oddsApiClient } from '../lib/apis/oddspapi';

async function main() {
  const envContent = fs.readFileSync('.env', 'utf8');
  const match = envContent.match(/ODDSPAPI_KEY=(.+)/);
  const rawKey = match ? match[1].trim() : '';
  const maskedKey = rawKey ? rawKey.substring(0, 8) + '...' : 'NOT_SET';
  console.log('MASKED ODDSPAPI_KEY:', maskedKey);

  try {
    const odds = await oddsApiClient.getOdds('soccer_epl', 'uk');
    console.log('ODDS_HEALTH: LIVE (' + (odds ? odds.length : 0) + ' games)');
  } catch (err: any) {
    console.log('ODDS_HEALTH: FAIL (' + (err.status || err.message) + ')');
  }
  process.exit(0);
}

main().catch(console.error);
