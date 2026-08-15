/**
 * Safe transcript-contamination scanner — checks EVERY variable value in env files
 * for tool-transcript markers, regardless of variable name.
 * Prints only variable NAMES of contaminated vars, never the values.
 */
import * as fs from 'fs';
import * as path from 'path';

const TRANSCRIPT_MARKERS = [
  'searched for',
  'viewed ',
  'ran command',
  'created ',
  'bearer searched',
  'tool use',
  'task_progress',
  'analyzing',
  'read_file',
  'write_to_file',
  'replace_in_file',
  'search_files',
  'list_files',
  'thinking',
  'attempt_completion',
  'ask_followup',
  'oddspapi_linkage_report',
  'validate.ts',
  '.test.ts',
  'integration',
  'checkpoint',
  'provenance-3matches',
];

const envFiles = [
  '.env',
  '.env.check',
  '.env.development',
  '.env.example',
  '.env.preview',
  '.env.prod.download',
  '.env.production',
  '.env.production.local',
  '.env.production.pull',
  '.env.production.vercel',
  '.env.test',
  '.env.test.download',
  '.env.vercel.pull',
  '.env.verify',
];

interface Finding {
  file: string;
  varName: string;
  marker: string;
}

const findings: Finding[] = [];
const varNamesSeen = new Set<string>();

for (const f of envFiles) {
  const abs = path.resolve(process.cwd(), f);
  if (!fs.existsSync(abs)) continue;
  const content = fs.readFileSync(abs, 'utf8');
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const varName = trimmed.slice(0, eq).trim();
    const rawValue = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!varName || varName.startsWith('#')) continue;
    varNamesSeen.add(varName);

    const lower = rawValue.toLowerCase();
    for (const marker of TRANSCRIPT_MARKERS) {
      if (lower.includes(marker)) {
        findings.push({ file: f, varName, marker });
      }
    }
  }
}

console.log('--- VARIABLE NAMES SEEN ACROSS ENV FILES (names only) ---');
const sorted = Array.from(varNamesSeen).sort();
console.log(sorted.join('\n'));
console.log(`\nTotal distinct variable names: ${sorted.length}`);

console.log('\n--- TRANSCRIPT-MARKER FINDINGS (name only, never value) ---');
if (findings.length === 0) {
  console.log('None found.');
} else {
  for (const finding of findings) {
    console.log(`  ${finding.file}: ${finding.varName} (marker: "${finding.marker}")`);
  }
}

console.log(`\nRESULT: ${findings.length === 0 ? 'NO transcript contamination in env files' : `${findings.length} CONTAMINATED VARIABLE(S) — FAIL`}`);
if (findings.length > 0) process.exit(1);