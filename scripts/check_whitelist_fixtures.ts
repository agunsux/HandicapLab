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

async function checkUpcomingInWhitelist() {
  const key = process.env.APIFOOTBALL_KEY;
  const now = new Date();
  const from = now.toISOString().slice(0, 10);
  const to = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  console.log(`Checking fixtures from ${from} to ${to} across whitelisted leagues...`);

  for (const l of WHITELIST_LEAGUES) {
    try {
      const res = await fetch(`https://v3.football.api-sports.io/fixtures?league=${l.id}&season=2026&from=${from}&to=${to}`, {
        headers: { 'x-apisports-key': key!, 'Accept': 'application/json' }
      });
      const data = await res.json();
      const count = data.response?.length || 0;
      console.log(`[${l.name} (${l.id})]: ${count} fixtures in 14-day window`);
      if (count > 0) {
        console.log(`  Next fixture: ${data.response[0].teams.home.name} vs ${data.response[0].teams.away.name} at ${data.response[0].fixture.date}`);
      }
    } catch (e: any) {
      console.error(`Error checking ${l.name}:`, e.message);
    }
  }
}

checkUpcomingInWhitelist().catch(console.error);

