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

async function inspectOddsPapiFixture() {
  const key = process.env.ODDS_PAPI_KEY;
  const res = await fetch(`https://api.oddspapi.io/v4/odds-by-tournaments?apiKey=${key}&tournamentIds=17&bookmakers=pinnacle`);
  const data = await res.json();
  const first = data[0];
  console.log('Keys of first fixture in OddsPapi:');
  for (const k of Object.keys(first)) {
    if (k !== 'bookmakerOdds') {
      console.log(`  ${k}:`, first[k]);
    }
  }
}

inspectOddsPapiFixture().catch(console.error);

