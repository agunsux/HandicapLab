import * as fs from 'fs';
import * as path from 'path';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match && !process.env[match[1].trim()]) {
        process.env[match[1].trim()] = match[2].trim().replace(/^["']+|["']+$/g, '');
      }
    }
  }
}

async function checkOddsPapi() {
  const key = process.env.ODDS_PAPI_KEY;
  // Check OddsPapi account first (unmetered)
  const accRes = await fetch(`https://api.oddspapi.io/v4/account?apiKey=${key}`);
  const accData = await accRes.json();
  console.log('OddsPapi account before:', accData.subscriptions?.[0]);

  // Check tournament 17 (Premier League)
  const res = await fetch(`https://api.oddspapi.io/v4/odds-by-tournaments?apiKey=${key}&tournamentIds=17&bookmakers=pinnacle`);
  console.log('HTTP status for tournament 17:', res.status);
  const data = await res.json();
  console.log(`OddsPapi returned ${Array.isArray(data) ? data.length : typeof data} items`);
  if (Array.isArray(data) && data.length > 0) {
    console.log('First 3 OddsPapi fixtures:', data.slice(0, 3).map((d: any) => ({
      id: d.id,
      name: d.name,
      startTime: d.startTime,
      hasPinnacle: Boolean(d.bookmakerOdds?.pinnacle),
      markets: d.bookmakerOdds?.pinnacle ? Object.keys(d.bookmakerOdds.pinnacle.markets || {}) : []
    })));
  }

  // Check OddsPapi account after (unmetered)
  const accAfter = await fetch(`https://api.oddspapi.io/v4/account?apiKey=${key}`);
  const accDataAfter = await accAfter.json();
  console.log('OddsPapi account after:', accDataAfter.subscriptions?.[0]);
}

checkOddsPapi().catch(console.error);

