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

async function check() {
  const key = process.env.APIFOOTBALL_KEY;
  // Check available seasons for league 39
  const res = await fetch('https://v3.football.api-sports.io/leagues?id=39', {
    headers: { 'x-apisports-key': key!, 'Accept': 'application/json' }
  });
  const data = await res.json();
  const seasons = data.response?.[0]?.seasons?.map((s: any) => ({ year: s.year, current: s.current, start: s.start, end: s.end }));
  console.log('League 39 Seasons:', seasons?.slice(-5));

  // Check next upcoming fixtures in API-Football without date filter
  const fixRes = await fetch('https://v3.football.api-sports.io/fixtures?league=39&next=5', {
    headers: { 'x-apisports-key': key!, 'Accept': 'application/json' }
  });
  const fixData = await fixRes.json();
  console.log('Next 5 Premier League fixtures:', fixData.response?.map((f: any) => ({
    id: f.fixture.id,
    date: f.fixture.date,
    home: f.teams.home.name,
    away: f.teams.away.name,
  })));
}

check().catch(console.error);

