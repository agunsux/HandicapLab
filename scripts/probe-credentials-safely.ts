/**
 * Safe credential probe.
 * NEVER prints secret values. Reports only:
 *   - whether the var is present
 *   - a structural validation verdict (VALID / MALFORMED / MISSING)
 * Structural checks include transcript-marker detection.
 */
import * as fs from 'fs';
import * as path from 'path';

// Load .env files the same way Next.js would (without overriding existing process.env)
const envFiles = ['.env.local', '.env', '.env.production.local', '.env.development', '.env.production'];
for (const f of envFiles) {
  const abs = path.resolve(process.cwd(), f);
  if (!fs.existsSync(abs)) continue;
  const content = fs.readFileSync(abs, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const k = trimmed.slice(0, eq).trim();
    const v = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, '');
    if (!(k in process.env)) {
      process.env[k] = v;
    }
  }
}

const TRANSCRIPT_MARKERS = [
  'searched for', 'viewed ', 'ran command', 'created ', 'bearer searched',
  'tool use', 'task_progress', 'analyzing', 'read_file', 'write_to_file',
  'replace_in_file', 'search_files', 'list_files', 'thinking',
  'oddspapi_linkage_report', 'validate.ts', '.test.ts', 'checkpoint',
];

type Verdict = 'VALID' | 'MALFORMED' | 'MISSING';

function validateCredential(value: string | undefined, isJwtLike: boolean, minLen: number): Verdict {
  if (!value || value.trim().length === 0) return 'MISSING';
  const v = value.trim();
  if (v.length < minLen) return 'MALFORMED';
  if (/\s/.test(v)) return 'MALFORMED'; // whitespace/newline corruption
  const lower = v.toLowerCase();
  for (const marker of TRANSCRIPT_MARKERS) {
    if (lower.includes(marker)) return 'MALFORMED';
  }
  if (isJwtLike) {
    // JWT has 3 dot-separated segments
    const parts = v.split('.');
    if (parts.length !== 3) return 'MALFORMED';
    for (const p of parts) {
      if (p.length < 10) return 'MALFORMED';
      if (!/^[A-Za-z0-9_-]+$/.test(p)) return 'MALFORMED';
    }
  }
  return 'VALID';
}

const checks: Array<{ name: string; varNames: string[]; jwtLike: boolean; minLen: number }> = [
  { name: 'OddsPAPI', varNames: ['ODDS_PAPI_KEY', 'ODDSPAPI_KEY'], jwtLike: false, minLen: 16 },
  { name: 'API-Football', varNames: ['APIFOOTBALL_KEY', 'API_FOOTBALL_KEY', 'VITE_APIFOOTBALL_KEY', 'NEXT_PUBLIC_APIFOOTBALL_KEY'], jwtLike: false, minLen: 16 },
  { name: 'Supabase Service Role', varNames: ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY'], jwtLike: true, minLen: 40 },
  { name: 'Supabase URL', varNames: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'], jwtLike: false, minLen: 20 },
  { name: 'CRON_SECRET', varNames: ['CRON_SECRET'], jwtLike: false, minLen: 16 },
];

console.log('--- SAFE CREDENTIAL PROBE (values never printed) ---');
let allValid = true;
for (const check of checks) {
  let foundVar: string | null = null;
  let verdict: Verdict = 'MISSING';
  for (const varName of check.varNames) {
    const value = process.env[varName];
    if (value !== undefined && value.trim().length > 0) {
      foundVar = varName;
      verdict = validateCredential(value, check.jwtLike, check.minLen);
      break;
    }
  }
  if (verdict !== 'VALID') allValid = false;
  console.log(
    `  [${verdict}] ${check.name}${foundVar ? ` (env: ${foundVar})` : ' — no env var set'}`
  );
}

console.log('');
if (allValid) {
  console.log('RESULT: ALL REQUIRED CREDENTIALS VALID IN RUNTIME ENV.');
} else {
  console.log('RESULT: FAIL — one or more credentials MISSING or MALFORMED.');
  console.log('Per policy: FAIL CLOSED. No provider requests will be made with corrupted/missing credentials.');
  process.exit(1);
}