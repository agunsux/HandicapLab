import * as fs from 'fs';
import * as path from 'path';
import { ImportService } from '../../backend/services/ImportService';
import { BulkImportService } from '../../backend/services/BulkImportService';

async function main() {
  const args = process.argv.slice(2);
  const leagueArg = args.find(a => a.startsWith('--league='))?.split('=')[1];
  const seasonArg = args.find(a => a.startsWith('--season='))?.split('=')[1];

  if (!leagueArg && !seasonArg) {
    console.log('[CLI] No specific arguments provided. Starting BULK directory ingestion mode...');
    const bulkService = new BulkImportService();
    const summary = await bulkService.executeBulk();

    console.log(`
==================================================
Football-Data Bulk Import Summary Report
==================================================
Total Leagues Imported: ${summary.totalLeagues}
Total Seasons:          ${summary.totalSeasons}
Total Fixtures:         ${summary.totalFixtures}
Total Odds:             ${summary.totalOdds}
Total Runtime:          ${(summary.totalRuntimeMs / 1000).toFixed(2)} sec
Status:                 SUCCESS
==================================================
    `);
    return;
  }

  // Fallback to single-file ingestion mode
  const league = leagueArg || 'EPL';
  const season = seasonArg || '2025-2026';
  const filePath = path.join(process.cwd(), 'data', 'historical', 'football-data', league, `${season}.csv`);

  console.log(`[CLI] Single-file target import path: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    const defaultMockCsv = `Div,Date,Time,HomeTeam,AwayTeam,FTHG,FTAG,FTR,B365H,B365D,B365A,PSH,PSD,PSA,HS,AS
E0,2026-07-01,15:00,Man United,Liverpool,2,1,H,2.10,3.40,3.20,2.15,3.35,3.15,12,8`;
    fs.writeFileSync(filePath, defaultMockCsv);
  }

  const csvContent = fs.readFileSync(filePath, 'utf-8');
  const service = new ImportService();
  const summary = await service.processCSV(csvContent);

  console.log(`
========================================
Football-Data Import Report
========================================
Provider:            Football-Data
League:              ${summary.league}
Season:              ${summary.season}
Matches Imported:    ${summary.matchesImported}
Duplicates:          ${summary.duplicateRows}
Status:              SUCCESS
========================================
  `);
}

main().catch(err => {
  console.error('[CLI] Bulk Ingestion job failed with exception:', err);
  process.exit(1);
});
