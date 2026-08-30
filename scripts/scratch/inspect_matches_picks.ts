import * as fs from 'fs';
import * as path from 'path';

const tracePath = path.resolve(process.cwd(), 'reports', 'LIVERPOOL_EVERTON_FORENSIC_TRACE.json');
const trace = JSON.parse(fs.readFileSync(tracePath, 'utf8'));

console.log('=== MATCHES SAMPLE (LIV/EVE) ===');
console.log(trace.database.matches.slice(0, 5).map((m: any) => ({
  id: m.id,
  home: m.home_team,
  away: m.away_team,
  kickoff: m.kickoff_time,
  league: m.league,
  status: m.status,
  is_synthetic: m.is_synthetic,
  source_type: m.source_type
})));

console.log('=== DAILY PICKS SAMPLE (LIV/EVE) ===');
console.log(trace.database.daily_picks.slice(0, 5).map((p: any) => ({
  id: p.id,
  fixture_id: p.fixture_id,
  home: p.home_team,
  away: p.away_team,
  kickoff_utc: p.kickoff_utc,
  market_type: p.market_type,
  status: p.status,
  source: p.source,
  created_at: p.created_at
})));
