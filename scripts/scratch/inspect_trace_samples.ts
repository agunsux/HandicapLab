import * as fs from 'fs';
import * as path from 'path';

const tracePath = path.resolve(process.cwd(), 'reports', 'LIVERPOOL_EVERTON_FORENSIC_TRACE.json');
const trace = JSON.parse(fs.readFileSync(tracePath, 'utf8'));

console.log('=== UI / CODE OCCURRENCES ===');
console.log(JSON.stringify(trace.uiAndCode, null, 2));

console.log('=== SAMPLE DB MATCHES (LIVERPOOL/EVERTON) ===');
console.log(JSON.stringify(trace.database.matches.slice(0, 3), null, 2));

console.log('=== SAMPLE DAILY PICKS (LIVERPOOL/EVERTON) ===');
console.log(JSON.stringify(trace.database.daily_picks.slice(0, 3), null, 2));

console.log('=== SAMPLE PREDICTIONS (LIVERPOOL/EVERTON) ===');
console.log(JSON.stringify(trace.database.predictions.slice(0, 3), null, 2));
