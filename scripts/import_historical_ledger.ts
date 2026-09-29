import { CanonicalBetLedgerService } from '../src/lib/ledger/canonicalBetLedger';
import { CanonicalPerformanceEngine } from '../src/lib/ledger/canonicalPerformanceEngine';
import { ReconciliationEngine } from '../src/lib/ledger/reconciliationEngine';
import { SalmoPerformanceSyncService } from '../src/lib/pipeline/salmoPerformanceSyncService';

async function main() {
  console.log('1. Importing existing stores...');
  const res = CanonicalBetLedgerService.importFromExistingStores();
  console.log('Import result:', res);

  const all = CanonicalBetLedgerService.getAllPredictions();
  console.log('Total predictions in canonical ledger:', all.length);

  console.log('2. Running reconciliation...');
  const audit = ReconciliationEngine.runAudit(all);
  console.log('Reconciliation status:', audit.status);
  console.log('Discrepancies:', audit.discrepancies);

  console.log('3. Generating Performance Report...');
  const report = CanonicalPerformanceEngine.generateReport(all);
  console.log('Total predictions:', report.totalPredictions);
  console.log('Settled:', report.settledPredictions);
  console.log('Pending:', report.pendingPredictions);
  console.log('ROI %:', report.roiPct);

  console.log('4. Synchronizing to Salmo...');
  const salmoRes = await SalmoPerformanceSyncService.syncToSalmo();
  console.log('Salmo sync status:', salmoRes.status);
}

main().catch(console.error);
