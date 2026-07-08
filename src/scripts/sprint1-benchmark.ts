import * as fs from 'fs';
import * as path from 'path';

const dataDir = path.join(process.cwd(), 'data/EPL');

function parseCSV(content: string) {
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(l => l.split(',').map(c => c.trim()));
  return { headers, rows };
}

async function run() {
  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.csv')).sort();
  
  let matches = 0;
  
  // Baselines
  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  
  // Financial Baselines (Flat Stake 1 unit)
  let alwaysHomeProfit = 0;
  let alwaysAwayProfit = 0;
  let alwaysFavoriteProfit = 0;
  let alwaysUnderdogProfit = 0;

  for (const file of files) {
    const content = fs.readFileSync(path.join(dataDir, file), 'utf-8');
    const { headers, rows } = parseCSV(content);
    
    const idxRes = headers.indexOf('FTR');
    const idxB365H = headers.indexOf('B365H');
    const idxB365D = headers.indexOf('B365D');
    const idxB365A = headers.indexOf('B365A');

    for (const row of rows) {
      if (row.length < headers.length) continue;
      matches++;
      
      const ftr = row[idxRes];
      const oddsH = parseFloat(row[idxB365H]);
      const oddsD = parseFloat(row[idxB365D]);
      const oddsA = parseFloat(row[idxB365A]);
      
      if (isNaN(oddsH) || isNaN(oddsA)) continue;

      if (ftr === 'H') homeWins++;
      if (ftr === 'A') awayWins++;
      if (ftr === 'D') draws++;

      // Always Home
      if (ftr === 'H') alwaysHomeProfit += (oddsH - 1);
      else alwaysHomeProfit -= 1;

      // Always Away
      if (ftr === 'A') alwaysAwayProfit += (oddsA - 1);
      else alwaysAwayProfit -= 1;

      // Always Favorite
      const isHomeFav = oddsH < oddsA;
      if (isHomeFav) {
        if (ftr === 'H') alwaysFavoriteProfit += (oddsH - 1);
        else alwaysFavoriteProfit -= 1;
        
        if (ftr === 'A') alwaysUnderdogProfit += (oddsA - 1);
        else alwaysUnderdogProfit -= 1;
      } else {
        if (ftr === 'A') alwaysFavoriteProfit += (oddsA - 1);
        else alwaysFavoriteProfit -= 1;
        
        if (ftr === 'H') alwaysUnderdogProfit += (oddsH - 1);
        else alwaysUnderdogProfit -= 1;
      }
    }
  }

  console.log('--- Phase D: Benchmark ---');
  console.log(`Total Matches Analysed: ${matches}`);
  console.log(`Outcomes -> H: ${homeWins} (${(homeWins/matches*100).toFixed(1)}%), A: ${awayWins} (${(awayWins/matches*100).toFixed(1)}%), D: ${draws} (${(draws/matches*100).toFixed(1)}%)`);
  console.log(`Always Home ROI: ${((alwaysHomeProfit / matches) * 100).toFixed(2)}%`);
  console.log(`Always Away ROI: ${((alwaysAwayProfit / matches) * 100).toFixed(2)}%`);
  console.log(`Always Favorite ROI: ${((alwaysFavoriteProfit / matches) * 100).toFixed(2)}%`);
  console.log(`Always Underdog ROI: ${((alwaysUnderdogProfit / matches) * 100).toFixed(2)}%`);
}

run();
