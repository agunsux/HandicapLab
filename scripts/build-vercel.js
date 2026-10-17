#!/usr/bin/env node
/**
 * scripts/build-vercel.js
 *
 * Dedicated production build script for Vercel Hobby tier.
 * Temporarily isolates `src/app/api` to `.backend_api` during `next build`,
 * ensuring Vercel only compiles frontend pages without generating >180 serverless functions.
 * All backend API routes are hosted on Google Cloud Run and proxied via Next.js rewrites.
 *
 * Restores `src/app/api` in all conditions (clean exit, error, SIGINT, SIGTERM).
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const apiDir = path.join(rootDir, 'src', 'app', 'api');
const tempDir = path.join(rootDir, '.backend_api');

let isIsolated = false;

function safeRename(source, destination, retries = 10, delayMs = 300) {
  for (let i = 0; i < retries; i++) {
    try {
      fs.renameSync(source, destination);
      return;
    } catch (err) {
      if ((err.code === 'EPERM' || err.code === 'EBUSY' || err.code === 'EACCES') && i < retries - 1) {
        Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
        continue;
      }
      throw err;
    }
  }
}

function restore() {
  if (!isIsolated) return;
  try {
    if (fs.existsSync(tempDir)) {
      if (fs.existsSync(apiDir)) {
        console.warn('[build-vercel] Both apiDir and tempDir exist. Cleaning up tempDir...');
        fs.rmSync(tempDir, { recursive: true, force: true });
      } else {
        safeRename(tempDir, apiDir);
        console.log('[build-vercel] Restored src/app/api from .backend_api.');
      }
    }
  } catch (err) {
    console.error('[build-vercel] Error restoring src/app/api:', err);
  } finally {
    isIsolated = false;
  }
}

// Ensure cleanup on termination
process.on('SIGINT', () => { restore(); process.exit(130); });
process.on('SIGTERM', () => { restore(); process.exit(143); });
process.on('exit', () => { restore(); });

// Check if a previous run left .backend_api
if (fs.existsSync(tempDir) && !fs.existsSync(apiDir)) {
  console.log('[build-vercel] Recovering from previously interrupted build...');
  safeRename(tempDir, apiDir);
}

try {
  if (fs.existsSync(apiDir)) {
    console.log('[build-vercel] Isolating src/app/api -> .backend_api for Vercel Hobby build...');
    safeRename(apiDir, tempDir);
    isIsolated = true;
  }

  console.log('[build-vercel] Starting next build for frontend...');
  execSync('npx next build', {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      VERCEL: '1',
      NEXT_TELEMETRY_DISABLED: '1',
    },
  });

  console.log('[build-vercel] Frontend build complete!');
} catch (error) {
  console.error('[build-vercel] Build failed:', error.message);
  process.exit(1);
} finally {
  restore();
}
