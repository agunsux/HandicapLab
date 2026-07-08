import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const SOURCE = 'C:/Users/RYZEN/.antigravity-ide/handicaplab/src/scripts/research-sprint2.ts';
const TARGET = 'C:/Users/RYZEN/.antigravity-ide/handicaplab/src/scripts/research-sprint2.clean.ts';
const raw = readFileSync(SOURCE, 'utf8');

// Find the first main().catch() - this is where valid code ends
const marker = 'main().catch(e=>{console.error(\'[FATAL]\',e);process.exit(1);});';
const idx = raw.indexOf(marker);
if (idx === -1) {
  console.error('ERROR: marker not found');
  process.exit(1);
}

// Keep everything up to and including the marker
const clean = raw.substring(0, idx + marker.length) + '\n';
writeFileSync(TARGET, clean, 'utf8');
console.error('OK: wrote', clean.length, 'bytes to', TARGET);
