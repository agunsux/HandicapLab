import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const timestamp = '2026-08-30T16-36-26-811Z';
const backupDir = path.resolve(process.cwd(), 'data', 'backups', `epic61_backup_${timestamp}`);

async function traceLiverpoolEverton() {
  console.log('=== LIVERPOOL / EVERTON FORENSIC TRACE ===');

  const findings: any = {
    database: {
      matches: [],
      daily_picks: [],
      predictions: [],
      prediction_snapshots: [],
      raw_matches: [],
      rivalry_pairs: []
    },
    uiAndCode: []
  };

  // 1. Check database tables
  for (const tbl of ['matches', 'daily_picks', 'predictions', 'prediction_snapshots', 'raw_matches', 'rivalry_pairs']) {
    const filePath = path.join(backupDir, `${tbl}.json`);
    if (!fs.existsSync(filePath)) continue;
    const rows = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    for (const r of rows) {
      const str = JSON.stringify(r).toLowerCase();
      if (str.includes('liverpool') || str.includes('everton')) {
        findings.database[tbl].push(r);
      }
    }
  }

  // 2. Check UI components
  const uiFiles = [
    'src/app/page.tsx',
    'src/app/(app)/predictions/page.tsx',
    'src/app/(app)/terminal/page.tsx',
    'src/app/(app)/ledger/page.tsx',
    'src/app/(app)/track-record/page.tsx',
    'src/app/(app)/dashboard/page.tsx',
    'src/components/predictions/PredictionFeed.tsx',
    'src/components/terminal/LivePredictionsGrid.tsx',
    'src/lib/terminalData.ts',
    'src/lib/pipeline/dailyAhShadowPipeline.ts',
    'src/services/backtestService.ts',
    'src/services/ledger-v2.ts',
    'src/lib/queries/picks.ts'
  ];

  for (const f of uiFiles) {
    const fullP = path.resolve(process.cwd(), f);
    if (!fs.existsSync(fullP)) continue;
    const content = fs.readFileSync(fullP, 'utf8');
    const lines = content.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.toLowerCase().includes('liverpool') || line.toLowerCase().includes('everton')) {
        findings.uiAndCode.push({
          file: f,
          line: i + 1,
          content: line.trim()
        });
      }
    }
  }

  console.log(`DB matches matching Liv/Eve: ${findings.database.matches.length}`);
  console.log(`DB daily_picks matching Liv/Eve: ${findings.database.daily_picks.length}`);
  console.log(`DB predictions matching Liv/Eve: ${findings.database.predictions.length}`);
  console.log(`DB prediction_snapshots matching Liv/Eve: ${findings.database.prediction_snapshots.length}`);
  console.log(`UI / Code occurrences matching Liv/Eve: ${findings.uiAndCode.length}`);

  fs.writeFileSync(
    path.resolve(process.cwd(), 'reports', 'LIVERPOOL_EVERTON_FORENSIC_TRACE.json'),
    JSON.stringify(findings, null, 2),
    'utf8'
  );
  console.log('Saved to reports/LIVERPOOL_EVERTON_FORENSIC_TRACE.json');
}

traceLiverpoolEverton().catch(console.error);
