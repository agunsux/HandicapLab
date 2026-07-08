import * as fs from 'fs';
import * as path from 'path';

const dataDir = path.join(process.cwd(), 'data/EPL');

function parseCSV(content: string) {
  const lines = content.split('\n').filter(l => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = lines.slice(1).map(l => l.split(',').map(c => c.trim()));
  return { headers, rows };
}

async function main() {
  console.log('--- Phase A: Dataset Audit (EPL Historical Data) ---');
  
  if (!fs.existsSync(dataDir)) {
    console.error(`Directory not found: ${dataDir}`);
    return;
  }

  const files = fs.readdirSync(dataDir).filter(f => f.endsWith('.csv')).sort();
  console.log(`Found ${files.length} seasons in ${dataDir}\n`);

  let totalMatches = 0;
  const allHeaders = new Set<string>();

  for (const file of files) {
    const content = fs.readFileSync(path.join(dataDir, file), 'utf-8');
    const { headers, rows } = parseCSV(content);
    
    headers.forEach(h => allHeaders.add(h));
    totalMatches += rows.length;

    const hasB365 = headers.includes('B365H');
    const hasAsian = headers.includes('B365AHH') || headers.includes('AHh');
    const hasOU = headers.includes('B365>2.5') || headers.includes('BbMx>2.5');

    console.log(`Season: ${file.replace('.csv', '')} - Matches: ${rows.length}`);
    console.log(`  Columns found: ${headers.length}`);
    console.log(`  Moneyline Coverage: ${hasB365 ? 'YES' : 'NO'}`);
    console.log(`  Asian Handicap Coverage: ${hasAsian ? 'YES' : 'NO'}`);
    console.log(`  Over/Under Coverage: ${hasOU ? 'YES' : 'NO'}\n`);
  }

  console.log(`Total Matches across all seasons: ${totalMatches}`);
}

main().catch(console.error);
