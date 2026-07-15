import { LakehouseIngestionService } from '../application/data/lakehouse-ingestion';
import { HistoricalReportPublisher } from '../application/reporting/historical-report-publisher';

import fs from 'fs';
import path from 'path';

async function main() {
  const allSeasons = [
    '2015-2016',
    '2016-2017',
    '2017-2018',
    '2018-2019',
    '2019-2020',
    '2020-2021',
    '2021-2022',
    '2022-2023',
    '2023-2024',
    '2024-2025'
  ];
  let seasons = [...allSeasons];

  const availableOnly = process.argv.includes('--available-only');
  if (availableOnly) {
    const eplDir = path.join(process.cwd(), 'data', 'EPL');
    seasons = seasons.filter(s => fs.existsSync(path.join(eplDir, `${s}.csv`)));
    console.log(`[CLI] Filtering to available seasons only: ${seasons.join(', ')}`);
  }

  console.log('================================================================');
  console.log('  EPIC 31B.6 — Historical Data Platform Consolidation Pipeline  ');
  console.log('================================================================');

  const service = new LakehouseIngestionService();
  const publisher = new HistoricalReportPublisher();

  try {
    const runResult = await service.executePipeline(seasons, allSeasons, 'EPL');
    await publisher.publish(runResult, seasons);

    console.log('\n================================================================');
    console.log('  Pipeline Ingestion Run Summary');
    console.log('================================================================');
    console.log(`  Run ID:               ${runResult.runId}`);
    console.log(`  Execution Mode:       ${runResult.executionMode}`);
    console.log(`  Seasons Processed:    ${runResult.processedSeasons}/${runResult.requestedSeasons}`);
    console.log(`  Completeness Rate:    ${runResult.datasetCompleteness}%`);
    console.log(`  Skipped Seasons:      ${runResult.skippedSeasons.join(', ') || 'None'}`);
    console.log(`  Total Fixtures:       ${runResult.rowsProcessed}`);
    console.log(`  Ingestion Speed:      ${runResult.rowsPerSecond} rows/sec`);
    console.log(`  Duration:             ${runResult.durationMs}ms`);
    console.log(`  Peak Memory:          ${runResult.peakMemoryMB} MB`);
    console.log(`  Data Quality Score:   ${runResult.qualityReport.overallScore}%`);
    console.log(`  Merge Conflicts:      ${runResult.mergeConflictsCount}`);
    console.log(`  Status:               SUCCESS (FROZEN)`);
    console.log('================================================================\n');

  } catch (err) {
    console.error('❌ Pipeline execution failed with error:', err);
    await publisher.publishFailure(err as Error, allSeasons);
    process.exit(1);
  }
}

main();
