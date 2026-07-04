import { ReplayEngine } from '../lib/replay/replay-engine';

async function main() {
  console.log('🔄 Running replay engine validation...');

  // Verify that ReplayEngine class contains required methods
  const hasHistory = typeof ReplayEngine.getPredictionHistory === 'function';
  const hasReplay = typeof ReplayEngine.runReplay === 'function';
  const hasCompare = typeof ReplayEngine.compareReplay === 'function';

  if (hasHistory && hasReplay && hasCompare) {
    console.log('✅ ReplayEngine methods (getPredictionHistory, runReplay, compareReplay): PRESENT');
    process.exit(0);
  } else {
    console.error('❌ ReplayEngine is missing required methods!');
    process.exit(1);
  }
}

main().catch(console.error);
