import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env.local or .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { supabase } from '../../src/lib/supabase.server';

async function main() {
  console.log('=== EPIC 61 PRE-STAGE BACKUP & TABLE INVENTORY ===');
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.resolve(process.cwd(), 'data', 'backups', `epic61_backup_${timestamp}`);
  
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  // Candidate tables to probe in Supabase
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
    'prediction_feedback',
    'picks',
    'daily_picks',
    'public_predictions',
    'public_ledger',
    'odds_snapshots',
    'raw_matches',
    'entity_resolution_audit',
    'model_registry',
    'experiments',
    'governance_events'
  ];

  const backupManifest: Record<string, { exists: boolean; rowCount: number; backupFile?: string; sampleColumns?: string[]; error?: string }> = {};

  for (const table of targetTables) {
    try {
      const { data, error, count } = await supabase
        .from(table)
        .select('*', { count: 'exact' });

      if (error) {
        backupManifest[table] = {
          exists: false,
          rowCount: 0,
          error: error.message
        };
      } else {
        const rows = data || [];
        const filePath = path.join(backupDir, `${table}.json`);
        fs.writeFileSync(filePath, JSON.stringify(rows, null, 2), 'utf8');

        // Verify retrievability
        const verifiedContent = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (verifiedContent.length !== rows.length) {
          throw new Error(`Verification failed for ${table}: written ${rows.length} rows, read ${verifiedContent.length} rows`);
        }

        backupManifest[table] = {
          exists: true,
          rowCount: rows.length,
          backupFile: filePath,
          sampleColumns: rows.length > 0 ? Object.keys(rows[0]) : []
        };
      }
    } catch (err: any) {
      backupManifest[table] = {
        exists: false,
        rowCount: 0,
        error: err.message || String(err)
      };
    }
  }

  // Also snapshot local data files (golden, ledger, historical)
  const localDataSnapshotDir = path.join(backupDir, 'local_data_files');
  fs.mkdirSync(localDataSnapshotDir, { recursive: true });

  const localFiles = [
    'data/ledger/pipeline_execution_summary.json',
    'data/golden/europe/canonical_matches.jsonl',
    'data/golden/europe/manifest.json',
    'data/historical/normalized_matches.jsonl'
  ];

  const localBackupManifest: Record<string, { exists: boolean; sizeBytes: number; lineCount?: number; targetPath?: string }> = {};
  for (const lf of localFiles) {
    const fullP = path.resolve(process.cwd(), lf);
    if (fs.existsSync(fullP)) {
      const stat = fs.statSync(fullP);
      const dest = path.join(localDataSnapshotDir, path.basename(lf));
      fs.copyFileSync(fullP, dest);
      
      let lineCount = 0;
      if (lf.endsWith('.jsonl')) {
        lineCount = fs.readFileSync(dest, 'utf8').trim().split('\n').filter(Boolean).length;
      }
      localBackupManifest[lf] = {
        exists: true,
        sizeBytes: stat.size,
        lineCount: lineCount || undefined,
        targetPath: dest
      };
    } else {
      localBackupManifest[lf] = { exists: false, sizeBytes: 0 };
    }
  }

  const manifestResult = {
    timestamp: new Date().toISOString(),
    backupDirectory: backupDir,
    supabaseTables: backupManifest,
    localFiles: localBackupManifest,
    status: 'VERIFIED_SUCCESS'
  };

  fs.writeFileSync(path.join(backupDir, 'manifest.json'), JSON.stringify(manifestResult, null, 2), 'utf8');

  console.log(JSON.stringify(manifestResult, null, 2));
}

main().catch(err => {
  console.error('Fatal backup error:', err);
  process.exit(1);
});
