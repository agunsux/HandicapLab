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

const WHITELIST_LEAGUES = [
  { id: 39, name: 'Premier League' },
  { id: 40, name: 'Championship' },
  { id: 135, name: 'Serie A' },
  { id: 78, name: 'Bundesliga' },
  { id: 140, name: 'La Liga' },
  { id: 61, name: 'Ligue 1' },
  { id: 88, name: 'Eredivisie' },
  { id: 98, name: 'J1 League' },
  { id: 292, name: 'K League 1' },
  { id: 279, name: 'Liga 1 Indonesia' },
];

async function checkNext() {
  const key = process.env.APIFOOTBALL_KEY;
  for (const l of WHITELIST_LEAGUES) {
    try {
      const res = await fetch(`https://v3.football.api-sports.io/fixtures?league=${l.id}&next=2`, {
        headers: { 'x-apisports-key': key!, 'Accept': 'application/json' }
      });
      const data = await res.json();
      if (data.response && data.response.length > 0) {
        console.log(`[${l.name}]: Next match on ${data.response[0].fixture.date} - ${data.response[0].teams.home.name} vs ${data.response[0].teams.away.name}`);
      } else {
        console.log(`[${l.name}]: No upcoming fixtures found`);
      }
    } catch (e: any) {
      console.error(`Error for ${l.name}:`, e.message);
    }
  }
}

checkNext().catch(console.error);

