/**
 * Safe env contamination scanner.
 * Detects values that look like tool-transcript text instead of real credentials.
 * Never prints the full secret values — only variable name + file + a safe descriptor.
 */
import * as fs from 'fs';
import * as path from 'path';

const TRANSCRIPT_MARKERS = [
  'Searched for',
  'Viewed ',
  'Ran command',
  'Created ',
  'Bearer Searched',
  '.ts',
  'Searching for',
  'Found ',
  'Reading ',
  'Writing ',
  'Edited ',
  'Tool Use',
  'task_progress',
  'analyzing',
  'Search',
  'file://',
];

const KEY_NAMES = [
  'ODDS_PAPI_KEY',
  'ODDSPAPI_KEY',
  'APIFOOTBALL_KEY',
  'API_FOOTBALL_KEY',
  'VITE_APIFOOTBALL_KEY',
  'NEXT_PUBLIC_APIFOOTBALL_KEY',
  'RAPIDAPI_KEY',
  'X_RAPIDAPI_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_SERVICE_KEY',
  'CRON_SECRET',
  'THESTATS_API_KEY',
];

interface Finding {
  file: string;
  varName: string;
  issue: 'TRANSCRIPT_TEXT' | 'HAS_WHITESPACE' | 'HAS_NEWLINE' | 'EMPTY' | 'PLACEHOLDER' | 'SHORT';
  safeDescription: string;
}

function classifyValue(file: string, varName: string, value: string): Finding | null {
  const v = value || '';

  if (v.trim().length === 0) {
    return { file, varName, issue: 'EMPTY', safeDescription: 'empty value' };
  }

  // Transcript markers case-insensitive
  const lower = v.toLowerCase();
  for (const marker of TRANSCRIPT_MARKERS) {
    if (lower.includes(marker.toLowerCase())) {
      return {
        file,
        varName,
        issue: 'TRANSCRIPT_TEXT',
        safeDescription: `contains transcript marker "${marker}"`,
      };
    }
  }

  if (/\s/.test(v)) {
    return { file, varName, issue: 'HAS_WHITESPACE', safeDescription: 'contains whitespace' };
  }

  if (v.includes('\n') || v.includes('\r')) {
    return { file, varName, issue: 'HAS_NEWLINE', safeDescription: 'contains newline' };
  }

  const lowerTrim = v.trim().toLowerCase();
  if (lowerTrim.includes('your_') || lowerTrim === 'xxxx' || lowerTrim.includes('placeholder') || lowerTrim.includes('changeme')) {
    return { file, varName, issue: 'PLACEHOLDER', safeDescription: 'placeholder-style value' };
  }

  if (v.trim().length < 16) {
    return { file, varName, issue: 'SHORT', safeDescription: `unusually short (${v.trim().length} chars)` };
  }

  return null;
}

function scanFile(filePath: string): Finding[] {
  const findings: Finding[] = [];
  if (!fs.existsSync(filePath)) return findings;
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const varName = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!KEY_NAMES.includes(varName)) continue;
    const finding = classifyValue(filePath, varName, value);
    if (finding) findings.push(finding);
  }
  return findings;
}

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

const allFindings: Finding[] = [];
for (const f of envFiles) {
  const abs = path.resolve(process.cwd(), f);
  const findings = scanFile(abs);
  if (findings.length > 0) {
    console.log(`\n=== ${f} ===`);
    for (const finding of findings) {
      console.log(
        `  [${finding.issue}] ${finding.varName} — ${finding.safeDescription}`
      );
      allFindings.push(finding);
    }
  }
}

console.log(`\n--- SCAN COMPLETE ---`);
console.log(`Files scanned: ${envFiles.length}`);
console.log(`Findings: ${allFindings.length}`);

if (allFindings.length > 0) {
  console.log(`\nRESULT: CONTAMINATION DETECTED — FAIL CLOSED`);
  process.exit(1);
} else {
  console.log(`RESULT: no contamination detected in scanned credential keys`);
}