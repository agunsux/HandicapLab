import { runOrchestrator } from '../lib/crons/orchestrator';

async function run() {
  console.log('Running Orchestrator directly...');
  try {
    const report = await runOrchestrator();
    console.log('Orchestrator finished with report:');
    console.log(JSON.stringify(report, null, 2));
  } catch (err) {
    console.error('Orchestrator failed:', err);
  }
}
run();
