import { DataQualityEngine } from '../lib/analytics/data-quality';

async function runReport() {
  console.log('[Data Quality Monitor] Running data quality audit...');
  const report = await DataQualityEngine.evaluate();
  
  console.log('DATA QUALITY REPORT\n');
  console.log(`Score:  ${report.score}`);
  console.log(`Status: ${report.status.toUpperCase()}`);
  console.log('\nMetrics:');
  console.log(JSON.stringify(report.metrics, null, 2));

  process.exit(report.status === 'broken' ? 1 : 0);
}

runReport().catch(err => {
  console.error(err);
  process.exit(1);
});
