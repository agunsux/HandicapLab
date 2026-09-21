import * as fs from 'fs';
import * as path from 'path';

const envLocalPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envLocalPath)) {
  const envContent = fs.readFileSync(envLocalPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const match = trimmed.match(/^([^=]+)=(.*)$/);
      if (match && !process.env[match[1].trim()]) {
        process.env[match[1].trim()] = match[2].trim().replace(/^["']+|["']+$/g, '');
      }
    }
  }
}

import { OddsPapiQuotaAllocator } from '../src/lib/providers/oddspapiQuotaAllocator';

async function testSync() {
  const key = process.env.ODDS_PAPI_KEY;
  console.log('Key present:', Boolean(key));
  const res = await OddsPapiQuotaAllocator.syncFromProviderAccount(key);
  console.log('Allocator State after sync:');
  console.log({
    totalMonthlyBudget: res.totalMonthlyBudget,
    totalUsed: res.totalUsed,
    totalRemaining: res.totalRemaining,
    usableRemaining: res.usableRemaining,
    reserveFloor: res.reserveFloor,
    status: res.status,
    lastSyncedAt: res.lastSyncedAt,
  });

  const decision = OddsPapiQuotaAllocator.canAcquire({
    leagueId: 'ENG-PL',
    tier: 'A',
    priority: 'HIGH',
    cost: 1,
  });
  console.log('Decision from canAcquire:', decision);
}

testSync().catch(console.error);

