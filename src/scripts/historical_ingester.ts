import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as csv from 'csv-parse/sync';
import { FootballDataCSVAdapter } from '../lib/data-platform/footballDataCSVAdapter';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost:54321';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  const dataDir = path.join(process.cwd(), 'data', 'bronze', 'football_data');
  if (!fs.existsSync(dataDir)) {
    console.error(`[Ingester] Directory not found: ${dataDir}`);
    return;
  }

  // Filter for VAR era (2019-2020 onwards)
  const files = fs.readdirSync(dataDir)
    .filter(f => f.endsWith('.csv'))
    .filter(f => {
      const year = parseInt(f.substring(0, 4), 10);
      return year >= 2019;
    });
  console.log(`[Ingester] Found ${files.length} CSV files.`);

  let totalMatches = 0;
  let totalOdds = 0;

  for (const file of files) {
    console.log(`[Ingester] Processing ${file}...`);
    const content = fs.readFileSync(path.join(dataDir, file), 'utf-8');
    const records = csv.parse(content, { columns: true, skip_empty_lines: true });

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      if (!row.HomeTeam || !row.AwayTeam) continue;

      const parsed = FootballDataCSVAdapter.parseCSVRow(row, i, file);
      
      // 1. Insert Match (Query first to avoid constraint issues)
      const { data: existingMatch } = await supabase.from('matches')
        .select('id')
        .eq('home_team', row.HomeTeam)
        .eq('away_team', row.AwayTeam)
        .eq('kickoff', parsed.fixture.kickoff)
        .single();
      
      let matchId = existingMatch?.id;

      if (!matchId) {
        const matchRes = await supabase.from('matches').insert({
          home_team: row.HomeTeam,
          away_team: row.AwayTeam,
          league: 'EPL',
          kickoff: parsed.fixture.kickoff,
          status: parsed.fixture.status,
          home_goals: parsed.fixture.home_goals,
          away_goals: parsed.fixture.away_goals
        }).select('id').single();

        if (matchRes.error) {
          console.error(`[Ingester] Match insert error for ${row.HomeTeam} vs ${row.AwayTeam}:`, matchRes.error);
          continue;
        }
        matchId = matchRes.data.id;
      }
      
      // We use matchId (which is a UUID) as the fixture_id for odds_snapshots
      // because odds_snapshots has fixture_id UUID.
      const fixtureId = matchId;
      const str = `${row.HomeTeam}-${row.AwayTeam}-${parsed.fixture.kickoff}`;
      
      totalMatches++;

      // 2. Upsert Odds Snapshots
      // Combine open and close odds
      const openSnapshot: any = { fixture_id: fixtureId, match_id: str, market: 'composite', bookmaker: 'Pinnacle', snapshot_label: 'opening', snapshot_time: parsed.oddsOpen[0]?.receivedAt || new Date().toISOString() };
      const closeSnapshot: any = { fixture_id: fixtureId, match_id: str, market: 'composite', bookmaker: 'Pinnacle', snapshot_label: 'closing', snapshot_time: parsed.oddsClose[0]?.receivedAt || new Date().toISOString() };

      for (const o of parsed.oddsOpen) {
        if (o.marketType === 'ML' && o.selection === 'home') openSnapshot.ml_home = o.oddsDecimal;
        if (o.marketType === 'ML' && o.selection === 'draw') openSnapshot.ml_draw = o.oddsDecimal;
        if (o.marketType === 'ML' && o.selection === 'away') openSnapshot.ml_away = o.oddsDecimal;
        if (o.marketType === 'OU' && o.selection === 'over') { openSnapshot.ou_over_odds = o.oddsDecimal; openSnapshot.ou_line = o.line; }
        if (o.marketType === 'OU' && o.selection === 'under') openSnapshot.ou_under_odds = o.oddsDecimal;
        if (o.marketType === 'AH' && o.selection === 'home') { openSnapshot.ah_home_odds = o.oddsDecimal; openSnapshot.ah_home_line = o.line; }
        if (o.marketType === 'AH' && o.selection === 'away') openSnapshot.ah_away_odds = o.oddsDecimal;
        // BTTS could be added here if it exists in parsed
      }

      for (const o of parsed.oddsClose) {
        if (o.marketType === 'ML' && o.selection === 'home') closeSnapshot.ml_home = o.oddsDecimal;
        if (o.marketType === 'ML' && o.selection === 'draw') closeSnapshot.ml_draw = o.oddsDecimal;
        if (o.marketType === 'ML' && o.selection === 'away') closeSnapshot.ml_away = o.oddsDecimal;
        if (o.marketType === 'OU' && o.selection === 'over') { closeSnapshot.ou_over_odds = o.oddsDecimal; closeSnapshot.ou_line = o.line; }
        if (o.marketType === 'OU' && o.selection === 'under') closeSnapshot.ou_under_odds = o.oddsDecimal;
        if (o.marketType === 'AH' && o.selection === 'home') { closeSnapshot.ah_home_odds = o.oddsDecimal; closeSnapshot.ah_home_line = o.line; }
        if (o.marketType === 'AH' && o.selection === 'away') closeSnapshot.ah_away_odds = o.oddsDecimal;
      }

      // Perform upsert based on our new unique constraint (fixture_id, bookmaker, snapshot_label)
      const oddsRes = await supabase.from('odds_snapshots').upsert([openSnapshot, closeSnapshot], { onConflict: 'fixture_id, bookmaker, snapshot_label' });
      
      if (oddsRes.error) {
         console.error(`[Ingester] Odds upsert error for ${row.HomeTeam} vs ${row.AwayTeam}:`, oddsRes.error);
         continue; // skip incrementing totalOdds
      }

      totalOdds += 2;
    }
  }

  console.log(`[Ingester] Done! Processed ${totalMatches} matches and ${totalOdds} odds snapshots.`);
}

main().catch(console.error);
