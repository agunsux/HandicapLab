import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!
);

const dataDir = path.join(process.cwd(), 'data/EPL');

function parseCSV(content: string) {
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(l => l.split(',').map(c => c.trim()));
  return { headers, rows };
}

// Map football-data team names to normalized names if needed
function normalizeTeam(t: string) {
  return t; 
}

async function run() {
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.csv')).sort();
  console.log(`Found ${files.length} CSV files. Dropping existing EPL matches and re-seeding...`);

  await supabase.from('matches').delete().eq('league', 'EPL');
  
  let batch: any[] = [];
  
  for (const file of files) {
    const season = file.replace('.csv', '');
    const content = fs.readFileSync(path.join(dataDir, file), 'utf-8');
    const { headers, rows } = parseCSV(content);
    
    const hDate = headers.indexOf('Date');
    const hTime = headers.indexOf('Time');
    const hHome = headers.indexOf('HomeTeam');
    const hAway = headers.indexOf('AwayTeam');
    const hFTHG = headers.indexOf('FTHG');
    const hFTAG = headers.indexOf('FTAG');
    
    for (const row of rows) {
      if (row.length < headers.length) continue;
      
      let dateStr = row[hDate];
      if (dateStr.includes('/')) {
         const parts = dateStr.split('/');
         if (parts[2].length === 2) parts[2] = '20' + parts[2];
         dateStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
      }
      
      const timeStr = row[hTime] || '15:00';
      const kickoff = new Date(`${dateStr}T${timeStr}:00Z`);

      batch.push({
        home_team: normalizeTeam(row[hHome]),
        away_team: normalizeTeam(row[hAway]),
        league: 'EPL',
        kickoff: kickoff.toISOString(),
        status: 'finished',
        home_goals: parseInt(row[hFTHG], 10),
        away_goals: parseInt(row[hFTAG], 10)
      });
      
      if (batch.length === 500) {
         const { error } = await supabase.from('matches').insert(batch);
         if (error) console.error(error.message);
         batch = [];
      }
    }
  }
  
  if (batch.length > 0) {
     const { error } = await supabase.from('matches').insert(batch);
     if (error) console.error(error.message);
  }

  const { count } = await supabase.from('matches').select('*', { count: 'exact', head: true }).eq('league', 'EPL');
  console.log(`Seeding complete! Total EPL matches in DB: ${count}`);
}

run();
