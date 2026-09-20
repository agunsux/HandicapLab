import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: ['duckdb'],
  outputFileTracingExcludes: {
    '*': [
      'artifacts/**/*',
      'docs/**/*',
      'archive/**/*',
      'tests/**/*',
      '.gemini/**/*',
      'node_modules/@next/swc*/**/*',
    ],
  },
  async redirects() {
    return [
      {
        source: '/dashboard',
        destination: '/app',
        permanent: true,
      },
      {
        source: '/signals',
        destination: '/app/picks',
        permanent: true,
      },
      {
        source: '/live',
        destination: '/app/picks',
        permanent: true,
      },
      {
        source: '/ledger',
        destination: '/app/ledger',
        permanent: true,
      }
    ];
  },
  async rewrites() {
    return [
      {
        source: '/api/cron/publishing-reconcile',
        destination: '/api/cron/pipeline?mode=reconcile',
      },
      {
        source: '/api/cron/settle-predictions',
        destination: '/api/cron/pipeline?mode=settle',
      },
      {
        source: '/api/performance/daily',
        destination: '/api/performance?view=daily',
      },
      {
        source: '/api/ledger/high-confidence',
        destination: '/api/ledger/high-confidence',
      },
      {
        source: '/api/cron/worldwide-scheduler',
        destination: '/api/cron/pipeline',
      },
      {
        source: '/api/ops/dashboard',
        destination: '/api/cron/pipeline?mode=ops',
      },
      {
        source: '/api/quota',
        destination: '/api/providers?view=quota',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,OPTIONS,DELETE' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  silent: true,
});
