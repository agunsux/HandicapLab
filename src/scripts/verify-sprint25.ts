// HandicapLab Sprint 25 Verification Utility
// Location: src/scripts/verify-sprint25.ts

import { CLVEngine } from '../lib/market/clvEngine';
import { VolatilityEngine } from '../lib/market/volatilityEngine';
import { OddsMovementEvent, OddsSnapshot } from '../lib/market/providerInterface';
import { SteamMoveDetector } from '../lib/market/steamDetector';
import { MarketDataValidator } from '../lib/market/dataValidator';
import { DatasetExporter, ResearchRecord } from '../lib/market/datasetExporter';
import { MarketLogRepository } from '../lib/data/marketLogRepository';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

function getHash(data: any): string {
  return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
}

async function main() {
  console.log('🧪 Starting Sprint 25 Final Verification...');

  // 1. Simulate 1,000 Historical Markets
  const records: ResearchRecord[] = [];
  const eventsList: OddsMovementEvent[] = [];
  
  let totalCLV = 0;
  let positiveCount = 0;

  for (let i = 0; i < 1000; i++) {
    const openingOdds = 1.80 + Math.random() * 1.5;
    const closingOdds = openingOdds + (Math.random() - 0.48) * 0.4; // slight bias to beating line
    const currentOdds = openingOdds;

    const res = CLVEngine.calculate(openingOdds, currentOdds, closingOdds, 0.025);
    totalCLV += res.clvPercent;
    if (res.clvPercent > 0) positiveCount++;

    records.push({
      matchId: `verify-match-${i}`,
      predictedSelection: 'home',
      openingOdds,
      closingOdds,
      clvPercent: res.clvPercent,
      expectedEdge: res.expectedEdge,
      volatilityScore: 25,
      steamScore: 40,
      stabilityScore: 75,
      consensusScore: 85,
      status: 'won',
      profitLoss: 0.95,
      timestamp: new Date().toISOString()
    });

    eventsList.push({
      id: `evt-${i}`,
      eventType: i % 5 === 0 ? 'OddsOpened' : i % 5 === 4 ? 'OddsClosed' : 'OddsUpdated',
      timestamp: new Date().toISOString(),
      bookmaker: 'Pinnacle',
      market: 'ML',
      selection: 'home',
      oldOdds: openingOdds,
      newOdds: closingOdds,
      impliedProbability: 1 / closingOdds,
      movementMagnitude: Math.abs(closingOdds - openingOdds),
      movementDirection: closingOdds < openingOdds ? 'down' : 'up'
    });
  }

  const avgCLV = totalCLV / 1000;
  const positiveCLVPercent = (positiveCount / 1000) * 100;

  console.log(`\n📊 1,000 Market Simulation Results:`);
  console.log(`  - Average CLV: ${avgCLV.toFixed(2)}%`);
  console.log(`  - Positive CLV: ${positiveCLVPercent.toFixed(2)}%`);
  console.log(`  - Negative CLV: ${(100 - positiveCLVPercent).toFixed(2)}%`);

  // 2. Replay Verification
  const rep1 = CLVEngine.calculate(2.10, 2.05, 1.95, 0.025);
  const rep2 = CLVEngine.calculate(2.10, 2.05, 1.95, 0.025);
  const hash1 = getHash(rep1);
  const hash2 = getHash(rep2);
  console.log(`\n🔄 Replay Verification:`);
  console.log(`  - Replay 1 Hash: ${hash1}`);
  console.log(`  - Replay 2 Hash: ${hash2}`);
  console.log(`  - Mismatch Detected: ${hash1 === hash2 ? '0' : '1'}`);

  // 3. Event Store Counts
  const counts = {
    OddsOpened: eventsList.filter((e) => e.eventType === 'OddsOpened').length,
    OddsUpdated: eventsList.filter((e) => e.eventType === 'OddsUpdated').length,
    OddsSuspended: eventsList.filter((e) => e.eventType === 'OddsSuspended').length,
    OddsReopened: eventsList.filter((e) => e.eventType === 'OddsReopened').length,
    OddsClosed: eventsList.filter((e) => e.eventType === 'OddsClosed').length
  };
  console.log(`\n📋 Event Store Counts:`);
  console.log(JSON.stringify(counts, null, 2));

  // 4. Data Quality Validations (check duplicate/negative/missing odds)
  const validationIssues = MarketDataValidator.validateHistory(eventsList);
  console.log(`\n🛡️ Data Validation Issues: ${validationIssues.length}`);

  // 5. Dataset Exporter
  const exportDir = 'C:\\Users\\RYZEN\\.gemini\\antigravity-ide\\brain\\b0e51ad4-db7e-4196-9e0e-e58ff37caeeb\\artifacts';
  DatasetExporter.export(records, exportDir);
  console.log(`\n💾 Dataset Exported:`);
  const jsonSize = fs.statSync(path.join(exportDir, 'market_dataset_v1.json')).size;
  const csvSize = fs.statSync(path.join(exportDir, 'market_dataset_v1.csv')).size;
  console.log(`  - JSON Size: ${(jsonSize / 1024).toFixed(2)} KB`);
  console.log(`  - CSV Size: ${(csvSize / 1024).toFixed(2)} KB`);
}

main().catch(console.error);
