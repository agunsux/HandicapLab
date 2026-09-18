import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

function getEnvMap(): Record<string, string> {
  const env: Record<string, string> = {};
  
  const files = ['.env', '.env.local'];
  for (const f of files) {
    const full = path.resolve(process.cwd(), f);
    if (fs.existsSync(full)) {
      const lines = fs.readFileSync(full, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          const val = trimmed.slice(eqIdx + 1).replace(/^["']|["']$/g, '').trim();
          env[key] = val;
        }
      }
    }
  }
  return env;
}

const requiredKeys = [
  'ODDS_PAPI_KEY',
  'FOOTYSTATS_API_KEY',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'CRON_SECRET',
  'NEXT_PUBLIC_APP_URL',
];

const envMap = getEnvMap();
const projects = ['salmo', 'handicap-lab'];

for (const project of projects) {
  console.log(`\n=== Syncing env vars to project: ${project} ===`);
  for (const key of requiredKeys) {
    const val = envMap[key] || (key === 'NEXT_PUBLIC_APP_URL' ? (project === 'salmo' ? 'https://salmo.dev' : 'https://handicaplab.dev') : '');
    if (!val) {
      console.warn(`[WARN] Missing ${key} in local env`);
      continue;
    }
    console.log(`Adding/updating ${key} to ${project}...`);
    try {
      const out = execSync(
        `npx vercel env add ${key} production --project ${project} --value "${val}" --force --yes --non-interactive`,
        { encoding: 'utf8', input: '' }
      );
      console.log(out.trim());
    } catch (err: any) {
      console.error(`Error adding ${key} to ${project}:`, err.message);
    }
  }
}

console.log('\n=== ENV SYNC COMPLETE ===');
