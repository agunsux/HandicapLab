import { calculateExpectedGoals, calculateOverUnderProbability, calculateAsianHandicapProbability, buildScoreGrid, fairOdds, edgePercentage } from '../lib/engine/probability';

console.log('==================================================');
console.log('         QUANT ENGINE SANITY SIMULATION           ');
console.log('==================================================\n');

// Helper to print 1X2 probabilities
function print1X2(grid: number[][]) {
  let home = 0, draw = 0, away = 0;
  for (let x = 0; x <= 10; x++) {
    for (let y = 0; y <= 10; y++) {
      if (x > y) home += grid[x][y];
      else if (x === y) draw += grid[x][y];
      else away += grid[x][y];
    }
  }
  console.log(`  1X2 Probabilities: Home: ${(home * 100).toFixed(2)}%, Draw: ${(draw * 100).toFixed(2)}%, Away: ${(away * 100).toFixed(2)}%`);
  console.log(`  Fair Odds:         Home: ${fairOdds(home).toFixed(3)}, Draw: ${fairOdds(draw).toFixed(3)}, Away: ${fairOdds(away).toFixed(3)}`);
  
  // Implied edge distribution against some sample market odds (e.g. 1X2 margin at 1.95 / 3.40 / 3.90)
  const homeMarket = 1.95;
  const drawMarket = 3.40;
  const awayMarket = 3.90;
  console.log(`  Edge (Market odds: H ${homeMarket} / D ${drawMarket} / A ${awayMarket}):`);
  console.log(`    Home Edge: ${edgePercentage(fairOdds(home), homeMarket).toFixed(2)}%`);
  console.log(`    Draw Edge: ${edgePercentage(fairOdds(draw), drawMarket).toFixed(2)}%`);
  console.log(`    Away Edge: ${edgePercentage(fairOdds(away), awayMarket).toFixed(2)}%`);
}

// Scenario 1: Strong Home vs Weak Away
console.log('Scenario 1: Strong Home vs Weak Away');
const homeS1 = { attack: 1.5, defense: 0.7 };
const awayS1 = { attack: 0.8, defense: 1.4 };
const leagueAvgGoalsS1 = 2.6;
const xGS1 = calculateExpectedGoals(homeS1, awayS1, leagueAvgGoalsS1);
console.log(`  Expected Goals: Home xG: ${xGS1.homeXG.toFixed(2)}, Away xG: ${xGS1.awayXG.toFixed(2)}`);
const gridS1 = buildScoreGrid(xGS1.homeXG, xGS1.awayXG, -0.1);
print1X2(gridS1);
console.log('');

// Scenario 2: Equal Teams
console.log('Scenario 2: Equal Teams');
const homeS2 = { attack: 1.0, defense: 1.0 };
const awayS2 = { attack: 1.0, defense: 1.0 };
const leagueAvgGoalsS2 = 2.6;
const xGS2 = calculateExpectedGoals(homeS2, awayS2, leagueAvgGoalsS2);
console.log(`  Expected Goals: Home xG: ${xGS2.homeXG.toFixed(2)}, Away xG: ${xGS2.awayXG.toFixed(2)}`);
const gridS2 = buildScoreGrid(xGS2.homeXG, xGS2.awayXG, -0.1);
print1X2(gridS2);
console.log('');

// Scenario 3: Low Scoring Match
console.log('Scenario 3: Low Scoring Match');
const homeS3 = { attack: 0.7, defense: 0.6 };
const awayS3 = { attack: 0.6, defense: 0.7 };
const leagueAvgGoalsS3 = 1.6; // Defensive/low-scoring league
const xGS3 = calculateExpectedGoals(homeS3, awayS3, leagueAvgGoalsS3);
console.log(`  Expected Goals: Home xG: ${xGS3.homeXG.toFixed(2)}, Away xG: ${xGS3.awayXG.toFixed(2)}`);
const ouS3 = calculateOverUnderProbability(xGS3.homeXG, xGS3.awayXG, 2.5, -0.1);
console.log(`  O/U 2.5 Probabilities: Over 2.5: ${(ouS3.over * 100).toFixed(2)}%, Under 2.5: ${(ouS3.under * 100).toFixed(2)}%`);
console.log(`  O/U Fair Odds:         Over 2.5: ${fairOdds(ouS3.over).toFixed(3)}, Under 2.5: ${fairOdds(ouS3.under).toFixed(3)}`);
console.log('');

// Scenario 4: Handicap Favorite -1
console.log('Scenario 4: Handicap Favorite -1.0');
const homeS4 = { attack: 1.6, defense: 0.8 };
const awayS4 = { attack: 0.9, defense: 1.5 };
const leagueAvgGoalsS4 = 2.8;
const xGS4 = calculateExpectedGoals(homeS4, awayS4, leagueAvgGoalsS4);
console.log(`  Expected Goals: Home xG: ${xGS4.homeXG.toFixed(2)}, Away xG: ${xGS4.awayXG.toFixed(2)}`);
const ahS4 = calculateAsianHandicapProbability(xGS4.homeXG, xGS4.awayXG, -1.0, -0.1);
console.log('  Asian Handicap -1.0 Probabilities (Home perspective):');
console.log(`    Full Win:     ${(ahS4.win * 100).toFixed(2)}%`);
console.log(`    Push/Refund:  ${(ahS4.push * 100).toFixed(2)}%`);
console.log(`    Full Loss:    ${(ahS4.loss * 100).toFixed(2)}%`);
console.log(`    Cover (Win + 0.5*HalfWin): ${(ahS4.cover * 100).toFixed(2)}%`);
console.log(`    Fair Cover Odds:           ${fairOdds(ahS4.cover).toFixed(3)}`);
console.log('');

console.log('==================================================');
console.log('      SANITY SIMULATION COMPLETED SUCCESSFULLY    ');
console.log('==================================================');
