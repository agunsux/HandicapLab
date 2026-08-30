import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { supabase } from '../../src/lib/supabase.server';

async function fetchAllRows(table: string): Promise<any[]> {
  const PAGE_SIZE = 1000;
  let allRows: any[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .range(from, to);

    if (error) {
      throw error;
    }

    if (!data || data.length === 0) {
      hasMore = false;
    } else {
      allRows = allRows.concat(data);
      if (data.length < PAGE_SIZE) {
        hasMore = false;
      } else {
        from += PAGE_SIZE;
      }
    }
  }

  return allRows;
}

async function main() {
  console.log('=== FULL PAGINATED BACKUP OF ALL SUPABASE TABLES ===');
  const timestamp = '2026-08-30T16-36-26-811Z'; // Keep same backup folder
  const backupDir = path.resolve(process.cwd(), 'data', 'backups', `epic61_backup_${timestamp}`);

  const targetTables = [
    'prediction_feed',
    'signals',
    'performance_ledger',
    'prediction_results',
    'prediction_audits',
    'fixtures',
    'matches',
    'wh_fixtures',
    'wh_predictions',
    'predictions',
    'prediction_snapshots',
    'daily_picks',
    'odds_snapshots',
    'raw_matches',
    'model_registry',
    'experiments',
    'governance_events'
  ];

  const tableStats: Record<string, { exists: boolean; totalRows: number; error?: string }> = {};

  for (const table of targetTables) {
    try {
      const rows = await fetchAllRows(table);
      const filePath = path.join(backupDir, `${table}.json`);
      fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf8');

      // Verify
      const readBack = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      if (readBack.length !== rows.length) {
        throw new Error(`Integrity mismatch on ${table}`);
      }

      tableStats[table] = {
        exists: true,
        totalRows: rows.length
      };
      console.log(`[BACKUP OK] Table: ${table.padEnd(25)} | Rows: ${rows.length}`);
    } catch (err: any) {
      tableStats[table] = {
        exists: false,
        totalRows: 0,
        error: err.message || String(err)
      };
      console.log(`[BACKUP SKIP/ERROR] Table: ${table.padEnd(25)} | Error: ${err.message}`);
    }
  }

  // Update manifest with exact full counts
  const manifestPath = path.join(backupDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  for (const [tbl, stat] of Object.entries(tableStats)) {
    if (manifest.supabaseTables[tbl]) {
      manifest.supabaseTables[tbl].rowCount = stat.totalRows;
      manifest.supabaseTables[tbl].exists = stat.exists;
    }
  }
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');

  console.log('=== BACKUP SUMMARY ===');
  console.log(JSON.stringify(tableStats, null, 2));
}

main().catch(err => {
  console.error('Fatal backup error:', err);
  process.exit(1);
});
