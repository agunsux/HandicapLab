import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const BUCKETS = [
  'REAL_PRODUCTION',
  'REAL_HISTORICAL',
  'RESEARCH_ONLY',
  'TEST_ONLY',
  'DOCUMENTATION',
  'MOCK',
  'DUMMY',
  'STALE',
  'DEAD_CODE'
] as const;

type ClassificationBucket = typeof BUCKETS[number];

interface Occurrence {
  sourceType: 'CODE' | 'DATABASE' | 'LOCAL_DATA';
  location: string; // file:line or table:row_id
  keyword: string;
  classification: ClassificationBucket;
  evidence: string;
  snippet?: string;
}

// 1. Analyze code files
function scanDirectory(dir: string, fileList: string[] = []): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const fullPath = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (
        e.name === 'node_modules' ||
        e.name === '.git' ||
        e.name === '.next' ||
        e.name === '.vercel' ||
        e.name === 'dist' ||
        e.name === 'coverage' ||
        e.name === 'brain' ||
        e.name === 'backups'
      ) {
        continue;
      }
      scanDirectory(fullPath, fileList);
    } else if (e.isFile()) {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

async function runAudit() {
  console.log('=== STARTING EPIC 61 STAGE A FORENSIC AUDIT ===');
  const occurrences: Occurrence[] = [];
  const rootDir = process.cwd();

  // Search patterns
  const keywords = [
    'moneyline',
    'Moneyline',
    '1X2',
    '1x2',
    'mock',
    'dummy',
    'demo',
    'sample',
    'placeholder',
    'fallback',
    'Liverpool',
    'Everton'
  ];

  // A. SCAN FILES
  const allFiles = scanDirectory(rootDir);
  console.log(`Total files to scan: ${allFiles.length}`);

  for (const filePath of allFiles) {
    const relPath = path.relative(rootDir, filePath).replace(/\\/g, '/');
    
    // Determine general file type
    const isTest = relPath.startsWith('tests/') || relPath.includes('.test.') || relPath.includes('__tests__');
    const isDoc = relPath.endsWith('.md') || relPath.startsWith('docs/');
    const isResearch = relPath.startsWith('research/') || relPath.startsWith('src/lib/research/');
    const isScript = relPath.startsWith('scripts/');
    const isData = relPath.startsWith('data/');
    const isSupabase = relPath.startsWith('supabase/');
    const isSrcProd = (relPath.startsWith('src/') || relPath.startsWith('app/') || relPath.startsWith('components/')) && !isTest && !isResearch;

    // Read file if text
    if (
      !relPath.endsWith('.ts') &&
      !relPath.endsWith('.tsx') &&
      !relPath.endsWith('.js') &&
      !relPath.endsWith('.jsx') &&
      !relPath.endsWith('.json') &&
      !relPath.endsWith('.jsonl') &&
      !relPath.endsWith('.sql') &&
      !relPath.endsWith('.md') &&
      !relPath.endsWith('.csv')
    ) {
      continue;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        for (const kw of keywords) {
          if (line.includes(kw)) {
            // Classify
            let bucket: ClassificationBucket = 'DEAD_CODE';
            let rationale = '';

            if (isTest) {
              bucket = 'TEST_ONLY';
              rationale = 'Occurs in test suite file for unit/integration testing';
            } else if (isDoc) {
              bucket = 'DOCUMENTATION';
              rationale = 'Occurs in documentation markdown or architecture record';
            } else if (isResearch) {
              bucket = 'RESEARCH_ONLY';
              rationale = 'Occurs in research pipeline, backtesting, or statistical exploration script';
            } else if (isScript) {
              if (relPath.includes('scratch') || relPath.includes('temp') || relPath.includes('diagnose')) {
                bucket = 'DEAD_CODE';
                rationale = 'Occurs in diagnostic, scratch, or legacy one-off helper script';
              } else {
                bucket = 'RESEARCH_ONLY';
                rationale = 'Occurs in pipeline execution or warehouse ingestion script';
              }
            } else if (isSupabase) {
              if (kw.toLowerCase().includes('moneyline') || kw === '1X2') {
                bucket = 'REAL_HISTORICAL';
                rationale = 'Occurs in historical Supabase migration schema definition';
              } else if (kw === 'Liverpool' || kw === 'Everton') {
                bucket = 'REAL_PRODUCTION';
                rationale = 'Occurs in rivalry pairs table seed or historical migration';
              } else {
                bucket = 'REAL_HISTORICAL';
                rationale = 'Occurs in SQL migration definitions';
              }
            } else if (isData) {
              if (relPath.includes('golden') || relPath.includes('historical') || relPath.includes('canonical')) {
                bucket = 'REAL_HISTORICAL';
                rationale = 'Real historical match dataset from verified sources (EPL/Europe)';
              } else if (relPath.includes('verification')) {
                bucket = 'RESEARCH_ONLY';
                rationale = 'Statistical verification and ablation reports';
              } else {
                bucket = 'REAL_HISTORICAL';
                rationale = 'Historical data artifact';
              }
            } else if (isSrcProd) {
              // In production source!
              if (kw === 'mock' || kw === 'dummy' || kw === 'sample' || kw === 'placeholder' || kw === 'fallback') {
                // Check context: is it a mock data generator, a fallback UI, or a test helper?
                if (line.includes('mock') && (line.includes('const mock') || line.includes('return mock') || line.includes('MOCK_'))) {
                  bucket = 'MOCK';
                  rationale = 'Synthetic mock object/generator in production source code path';
                } else if (line.includes('dummy') || line.includes('DUMMY')) {
                  bucket = 'DUMMY';
                  rationale = 'Hardcoded dummy value in production path';
                } else if (line.includes('fallback') || line.includes('placeholder')) {
                  bucket = 'MOCK';
                  rationale = 'Fallback/placeholder data structure in production component';
                } else {
                  bucket = 'REAL_PRODUCTION';
                  rationale = 'Production code reference or variable naming';
                }
              } else if (kw.toLowerCase().includes('moneyline') || kw === '1X2') {
                bucket = 'REAL_PRODUCTION';
                rationale = 'Production type definition, market settlement, or odds ingestion referencing Moneyline';
              } else if (kw === 'Liverpool' || kw === 'Everton') {
                // Check if it is hardcoded UI or team registry
                if (relPath.includes('teamRegistry') || relPath.includes('teamNormalizer') || relPath.includes('entityResolver')) {
                  bucket = 'REAL_PRODUCTION';
                  rationale = 'Real team canonical registry and alias normalizer in production path';
                } else {
                  bucket = 'MOCK';
                  rationale = 'Hardcoded team literal in component or service';
                }
              }
            }

            occurrences.push({
              sourceType: 'CODE',
              location: `${relPath}:${i + 1}`,
              keyword: kw,
              classification: bucket,
              evidence: rationale,
              snippet: line.trim().substring(0, 140)
            });
          }
        }
      }
    } catch (err) {
      // Ignore binary files
    }
  }

  // B. SCAN DATABASE TABLES (From our verified backup snapshot)
  const timestamp = '2026-08-30T16-36-26-811Z';
  const backupDir = path.resolve(process.cwd(), 'data', 'backups', `epic61_backup_${timestamp}`);
  
  const dbTables = [
    'matches',
    'predictions',
    'prediction_snapshots',
    'daily_picks',
    'odds_snapshots',
    'raw_matches',
    'wh_fixtures',
    'model_registry',
    'experiments',
    'rivalry_pairs',
    'quota_state',
    'match_features'
  ];

  const dbBucketCounts: Record<string, Record<ClassificationBucket, number>> = {};
  const liverpoolEvertonDbRecords: any[] = [];

  for (const tbl of dbTables) {
    dbBucketCounts[tbl] = {
      REAL_PRODUCTION: 0,
      REAL_HISTORICAL: 0,
      RESEARCH_ONLY: 0,
      TEST_ONLY: 0,
      DOCUMENTATION: 0,
      MOCK: 0,
      DUMMY: 0,
      STALE: 0,
      DEAD_CODE: 0
    };

    const filePath = path.join(backupDir, `${tbl}.json`);
    if (!fs.existsSync(filePath)) continue;

    const rows: any[] = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    console.log(`Auditing table ${tbl}: ${rows.length} rows`);

    for (let rIdx = 0; rIdx < rows.length; rIdx++) {
      const row = rows[rIdx];
      const rowStr = JSON.stringify(row);
      const rowId = row.id || row.fixture_id || row.match_id || `row_${rIdx}`;

      // Check Liverpool / Everton
      const isLivEve =
        (row.home_team && (row.home_team.includes('Liverpool') || row.home_team.includes('Everton'))) ||
        (row.away_team && (row.away_team.includes('Liverpool') || row.away_team.includes('Everton'))) ||
        (row.team_a && (row.team_a.includes('Liverpool') || row.team_a.includes('Everton'))) ||
        (row.team_b && (row.team_b.includes('Liverpool') || row.team_b.includes('Everton'))) ||
        (row.match && (row.match.includes('Liverpool') || row.match.includes('Everton')));

      if (isLivEve) {
        liverpoolEvertonDbRecords.push({
          table: tbl,
          rowId,
          row
        });
      }

      // Check Table-specific classification
      if (tbl === 'matches') {
        // Check if real fixture or synthetic
        const isSynthetic = row.is_synthetic === true || row.source_type === 'SYNTHETIC' || String(rowId).startsWith('mock-');
        const kickoff = new Date(row.kickoff_time || row.match_date || row.kickoff);
        const isPast = !isNaN(kickoff.getTime()) && kickoff.getTime() < Date.now();

        if (isSynthetic) {
          dbBucketCounts[tbl].MOCK++;
          occurrences.push({
            sourceType: 'DATABASE',
            location: `table:matches:id=${rowId}`,
            keyword: 'synthetic_match',
            classification: 'MOCK',
            evidence: `Synthetic match detected: is_synthetic=${row.is_synthetic}`
          });
        } else if (isPast) {
          dbBucketCounts[tbl].REAL_HISTORICAL++;
        } else {
          dbBucketCounts[tbl].REAL_PRODUCTION++;
        }
      } else if (tbl === 'predictions' || tbl === 'daily_picks' || tbl === 'prediction_snapshots') {
        const isMock =
          row.source === 'mock' ||
          row.source_system === 'mock' ||
          String(rowId).startsWith('mock-') ||
          (row.rejection_reason && row.rejection_reason.includes('MOCK'));

        const market = (row.market || row.market_type || '').toUpperCase();
        const isMoneyline = market === 'MONEYLINE' || market === '1X2' || market === 'ML';

        if (isMock) {
          dbBucketCounts[tbl].MOCK++;
          occurrences.push({
            sourceType: 'DATABASE',
            location: `table:${tbl}:id=${rowId}`,
            keyword: 'mock_prediction',
            classification: 'MOCK',
            evidence: `Mock prediction row: source=${row.source || row.source_system}`
          });
        } else if (isMoneyline) {
          dbBucketCounts[tbl].REAL_HISTORICAL++;
          occurrences.push({
            sourceType: 'DATABASE',
            location: `table:${tbl}:id=${rowId}`,
            keyword: 'moneyline',
            classification: 'REAL_HISTORICAL',
            evidence: `Historical Moneyline prediction record: market=${market}`
          });
        } else {
          dbBucketCounts[tbl].REAL_PRODUCTION++;
        }
      } else if (tbl === 'raw_matches' || tbl === 'match_features') {
        dbBucketCounts[tbl].REAL_HISTORICAL++;
      } else if (tbl === 'odds_snapshots') {
        dbBucketCounts[tbl].REAL_HISTORICAL++;
      } else if (tbl === 'rivalry_pairs' || tbl === 'model_registry' || tbl === 'quota_state' || tbl === 'wh_fixtures' || tbl === 'experiments') {
        dbBucketCounts[tbl].REAL_PRODUCTION++;
      }
    }
  }

  // Summary counts
  const codeBucketCounts: Record<ClassificationBucket, number> = {
    REAL_PRODUCTION: 0,
    REAL_HISTORICAL: 0,
    RESEARCH_ONLY: 0,
    TEST_ONLY: 0,
    DOCUMENTATION: 0,
    MOCK: 0,
    DUMMY: 0,
    STALE: 0,
    DEAD_CODE: 0
  };

  for (const occ of occurrences) {
    if (occ.sourceType === 'CODE') {
      codeBucketCounts[occ.classification]++;
    }
  }

  const result = {
    timestamp: new Date().toISOString(),
    totalCodeOccurrences: occurrences.filter(o => o.sourceType === 'CODE').length,
    codeBucketCounts,
    dbBucketCounts,
    liverpoolEvertonDbRecordsCount: liverpoolEvertonDbRecords.length,
    liverpoolEvertonDbRecords,
    occurrences
  };

  const outReportPath = path.resolve(process.cwd(), 'reports', 'EPIC61_STAGE_A_AUDIT_REPORT.json');
  fs.writeFileSync(outReportPath, JSON.stringify(result, null, 2), 'utf8');

  console.log('=== AUDIT COMPLETE ===');
  console.log(`Saved report to ${outReportPath}`);
  console.log('Code occurrences breakdown:', codeBucketCounts);
  console.log('Database row breakdown:', dbBucketCounts);
  console.log(`Liverpool/Everton DB records found: ${liverpoolEvertonDbRecords.length}`);
}

runAudit().catch(console.error);
