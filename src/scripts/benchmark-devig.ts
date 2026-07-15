import { removeVigProportional, removeVigShin } from '../lib/settlement-core/devig';
import { performance } from 'perf_hooks';

function runBenchmark() {
  const odds = { home: 2.00, draw: 3.50, away: 4.00 };

  console.log('========================================================================');
  console.log('                       DE-VIG BENCHMARK REPORT');
  console.log('========================================================================');
  console.log('Odds Input: Home = 2.00, Draw = 3.50, Away = 4.00');
  console.log('------------------------------------------------------------------------');

  // Proportional DeVig
  const prop = removeVigProportional(odds);
  const propFairOdds = {
    home: Number((1 / prop.fair.home).toFixed(4)),
    draw: Number((1 / prop.fair.draw).toFixed(4)),
    away: Number((1 / prop.fair.away).toFixed(4))
  };

  // Shin DeVig
  const shin = removeVigShin(odds);
  const shinFairOdds = {
    home: Number((1 / shin.fair.home).toFixed(4)),
    draw: Number((1 / shin.fair.draw).toFixed(4)),
    away: Number((1 / shin.fair.away).toFixed(4))
  };

  console.log('1. Implied Probabilities (1 / Odds):');
  console.log(`   - Home: ${(1/odds.home).toFixed(6)} (${(100/odds.home).toFixed(2)}%)`);
  console.log(`   - Draw: ${(1/odds.draw).toFixed(6)} (${(100/odds.draw).toFixed(2)}%)`);
  console.log(`   - Away: ${(1/odds.away).toFixed(6)} (${(100/odds.away).toFixed(2)}%)`);
  console.log(`   - Overround (Vig): ${(prop.overround * 100).toFixed(4)}%`);
  console.log('------------------------------------------------------------------------');

  console.log('2. Proportional Method (Multiplicative):');
  console.log(`   - Fair Probabilities: Home = ${prop.fair.home.toFixed(6)}, Draw = ${prop.fair.draw.toFixed(6)}, Away = ${prop.fair.away.toFixed(6)}`);
  console.log(`   - Fair Odds:          Home = ${propFairOdds.home.toFixed(4)}, Draw = ${propFairOdds.draw.toFixed(4)}, Away = ${propFairOdds.away.toFixed(4)}`);
  console.log('------------------------------------------------------------------------');

  console.log("3. Shin's Method (Iterative Bisection):");
  console.log(`   - Shin Z (Insider proportion): ${shin.shinZ?.toFixed(6)}`);
  console.log(`   - Fair Probabilities: Home = ${shin.fair.home.toFixed(6)}, Draw = ${shin.fair.draw.toFixed(6)}, Away = ${shin.fair.away.toFixed(6)}`);
  console.log(`   - Fair Odds:          Home = ${shinFairOdds.home.toFixed(4)}, Draw = ${shinFairOdds.draw.toFixed(4)}, Away = ${shinFairOdds.away.toFixed(4)}`);
  console.log('------------------------------------------------------------------------');

  console.log('4. Deviation Analysis (Shin vs Proportional):');
  const diffHome = shin.fair.home - prop.fair.home;
  const diffDraw = shin.fair.draw - prop.fair.draw;
  const diffAway = shin.fair.away - prop.fair.away;
  console.log(`   - Home Diff: ${diffHome > 0 ? '+' : ''}${diffHome.toFixed(6)}`);
  console.log(`   - Draw Diff: ${diffDraw > 0 ? '+' : ''}${diffDraw.toFixed(6)}`);
  console.log(`   - Away Diff: ${diffAway > 0 ? '+' : ''}${diffAway.toFixed(6)}`);
  console.log('   - Interpretation: Shin attributes more of the overround reduction to the');
  console.log('     longshot (Away) than the favorite (Home), which matches the favorite-longshot bias.');
  console.log('------------------------------------------------------------------------');

  // Latency & Throughput Benchmark
  console.log('5. Performance Stress Test (100,000 runs):');
  
  const startProp = performance.now();
  for (let i = 0; i < 100000; i++) {
    removeVigProportional(odds);
  }
  const endProp = performance.now();
  const timeProp = endProp - startProp;

  const startShin = performance.now();
  for (let i = 0; i < 100000; i++) {
    removeVigShin(odds);
  }
  const endShin = performance.now();
  const timeShin = endShin - startShin;

  console.log(`   - Proportional Method: ${timeProp.toFixed(2)} ms (${Math.round(100000 / (timeProp / 1000))} ops/sec)`);
  console.log(`   - Shin's Method:       ${timeShin.toFixed(2)} ms (${Math.round(100000 / (timeShin / 1000))} ops/sec)`);
  console.log(`   - Latency Multiplier:  ${(timeShin / timeProp).toFixed(1)}x slower`);
  console.log('========================================================================');
}

runBenchmark();
