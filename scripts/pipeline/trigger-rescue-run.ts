import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env', override: false });

import { PoissonRescueService } from '../../src/lib/pipeline/rescue/poissonRescueService';

async function main() {
  const targetDate = process.argv[2] || undefined;
  console.log(`Triggering SALMO Rescue Pipeline (targetDate: ${targetDate || 'auto'})...`);

  const result = await PoissonRescueService.execute({ targetDate });
  console.log('Execution completed!');
  console.log('Telemetry:', JSON.stringify(result.telemetry, null, 2));
  console.log(`Predictions generated: ${result.predictions.length}`);
}

main().catch(console.error);
