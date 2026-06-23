import { runSimulation } from '../lib/simulation/batchRunner';

async function main() {
  const args = process.argv.slice(2);
  let seed: number | undefined = undefined;
  
  const seedArg = args.find(a => a.startsWith('--seed='));
  if (seedArg) {
    seed = parseInt(seedArg.split('=')[1], 10);
  }

  const batchSize = 10000;
  console.log(`Starting simulation engine for ${batchSize} matches...`);
  if (seed !== undefined) {
    console.log(`Using fixed seed: ${seed}`);
  }
  
  const { guardStatuses } = runSimulation(batchSize, seed);
  
  console.log('Simulation complete');
  if (guardStatuses.length > 0) {
    console.warn('Guard Status Flags:', guardStatuses.join(', '));
  }
}

main().catch(console.error);
