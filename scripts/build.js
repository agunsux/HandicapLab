#!/usr/bin/env node
/**
 * scripts/build.js
 *
 * Universal build dispatcher:
 * - If running in Vercel (process.env.VERCEL is set), routes to scripts/build-vercel.js.
 * - Otherwise (Docker, Cloud Run, local development), runs normal `next build`.
 */

const { execSync } = require('child_process');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

if (process.env.VERCEL) {
  console.log('[build] Vercel environment detected. Delegating to build-vercel.js...');
  require('./build-vercel.js');
} else {
  console.log('[build] Standard environment detected. Running next build...');
  try {
    execSync('npx next build', {
      cwd: rootDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        NEXT_TELEMETRY_DISABLED: '1',
      },
    });
  } catch (error) {
    process.exit(1);
  }
}
