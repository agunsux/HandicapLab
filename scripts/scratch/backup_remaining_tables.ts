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

    if (error) throw error;
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
  const timestamp = '2026-08-30T16-36-26-811Z';
  const backupDir = path.resolve(process.cwd(), 'data', 'backups', `epic61_backup_${timestamp}`);
  const manifestPath = path.join(backupDir, 'manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

  const tables = ['match_features', 'rivalry_pairs', 'quota_state'];
  for (const t of tables) {
    const rows = await fetchAllRows(t);
    const filePath = path.join(backupDir, `${t}.json`);
    fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf8');

    // verify
    const readBack = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (readBack.length !== rows.length) throw new Error(`Mismatch on ${t}`);

    manifest.supabaseTables[t] = {
      exists: true,
      rowCount: rows.length,
      backupFile: filePath,
      sampleColumns: rows.length > 0 ? Object.keys(rows[0]) : []
    };
    console.log(`[BACKUP OK] Table: ${t} | Rows: ${rows.length}`);
  }

  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log('Manifest updated with all active tables.');
}

main().catch(console.error);
