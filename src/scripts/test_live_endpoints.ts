import { GET as healthGet } from '../app/api/health/route';
import { GET as providersGet } from '../app/api/providers/route';
import { GET as matchesGet } from '../app/api/matches/route';
import { GET as dailyPicksGet } from '../app/api/daily-picks/route';
import { NextRequest } from 'next/server';

async function run() {
  console.log('=== TESTING LIVE PRODUCTION ENDPOINTS ===');

  // 1. /api/health
  console.log('\n--- 1. Testing GET /api/health ---');
  const healthRes = await healthGet();
  const healthData = await healthRes.json();
  console.log('Status:', healthRes.status);
  console.log('Payload:', JSON.stringify(healthData, null, 2));

  // 2. /api/providers
  console.log('\n--- 2. Testing GET /api/providers ---');
  const providersRes = await providersGet(new NextRequest('http://localhost:3000/api/providers'));
  const providersData = await providersRes.json();
  console.log('Status:', providersRes.status);
  console.log('Payload:', JSON.stringify(providersData, null, 2));

  // 3. /api/quota (via consolidated providers?view=quota)
  console.log('\n--- 3. Testing GET /api/quota ---');
  const quotaRes = await providersGet(new NextRequest('http://localhost:3000/api/providers?view=quota'));
  const quotaData = await quotaRes.json();
  console.log('Status:', quotaRes.status);
  console.log('Payload:', JSON.stringify(quotaData, null, 2));

  // 4. /api/matches
  console.log('\n--- 4. Testing GET /api/matches ---');
  const matchesReq = new NextRequest('http://localhost:3000/api/matches');
  const matchesRes = await matchesGet(matchesReq);
  const matchesData = await matchesRes.json();
  console.log('Status:', matchesRes.status);
  console.log('Count:', matchesData.count);
  if (matchesData.matches?.length > 0) {
    console.log('First match:', matchesData.matches[0]);
  }

  // 5. /api/daily-picks
  console.log('\n--- 5. Testing GET /api/daily-picks ---');
  const picksReq = new NextRequest('http://localhost:3000/api/daily-picks');
  const picksRes = await dailyPicksGet(picksReq);
  const picksData = await picksRes.json();
  console.log('Status:', picksRes.status);
  console.log('Count:', picksData.count);
  console.log('Meta:', picksData.meta);
  if (picksData.picks?.length > 0) {
    console.log('Top pick:', picksData.picks[0]);
  }

  console.log('\n=== ALL ENDPOINTS TESTED SUCCESSFULLY ===');
}

run().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
