import { GET as healthGet } from '../app/api/v1/health/route';
import { GET as featuresGet } from '../app/api/v1/features/route';
import { GET as predictionsGet } from '../app/api/v1/predictions/route';
import { GET as recommendationsGet } from '../app/api/v1/recommendations/route';
import { GET as edgesGet } from '../app/api/v1/edges/route';

import * as fs from 'fs';
import * as path from 'path';

const artifactsDir = path.join('C:', 'Users', 'RYZEN', '.gemini', 'antigravity-ide', 'brain', 'b0e51ad4-db7e-4196-9e0e-e58ff37caeeb', 'artifacts');
const apiResponsesDir = path.join(artifactsDir, 'api_responses');

// Ensure directories exist
if (!fs.existsSync(artifactsDir)) {
  fs.mkdirSync(artifactsDir, { recursive: true });
}
if (!fs.existsSync(apiResponsesDir)) {
  fs.mkdirSync(apiResponsesDir, { recursive: true });
}

async function verifyEndpoint(name: string, handler: any, authHeaderValue?: string) {
  const headers = new Headers();
  headers.set('x-forwarded-for', '127.0.0.1');
  if (authHeaderValue) {
    headers.set('authorization', `Bearer ${authHeaderValue}`);
  }

  const req = new Request(`http://localhost:3000/api/v1/${name}`, {
    method: 'GET',
    headers
  });

  const start = performance.now();
  const res = await handler(req);
  const duration = performance.now() - start;
  const json = await res.json();

  console.log(`[Local API Verification] /api/v1/${name.padEnd(15)} : Status ${res.status} | Duration = ${duration.toFixed(2)}ms`);

  // Write response to file
  const filePath = path.join(apiResponsesDir, `${name}.json`);
  fs.writeFileSync(filePath, JSON.stringify(json, null, 2));

  // Assert schema properties
  if (res.status !== 200) {
    throw new Error(`Endpoint ${name} failed with status ${res.status}`);
  }
  if (!json.metadata || !json.data) {
    throw new Error(`Endpoint ${name} does not match EnterpriseResponse schema`);
  }
}

async function main() {
  console.log('🏁 Starting Local API Contract Verification...\n');
  await verifyEndpoint('health', healthGet);
  await verifyEndpoint('features', featuresGet);
  await verifyEndpoint('predictions', predictionsGet);
  await verifyEndpoint('recommendations', recommendationsGet, 'mock-premium-token');
  await verifyEndpoint('edges', edgesGet, 'mock-premium-token');
  console.log('\n✅ All local endpoints verified and responses written to artifacts/api_responses/');
}

main().catch(err => {
  console.error('❌ Local API verification failed:', err);
  process.exit(1);
});
