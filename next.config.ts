import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  output: 'standalone',
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
      'scripts/**/*',
      'latest_user_prompt.txt',
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
    const isVercel = Boolean(process.env.VERCEL);
    const backendUrl =
      process.env.CLOUD_RUN_BACKEND_URL ||
      'https://handicaplab-production-129269713730.asia-southeast2.run.app';

    const internalRewrites = [
      {
        source: '/api/cron/publishing-reconcile',
        destination: isVercel
          ? `${backendUrl}/api/cron/pipeline?mode=reconcile`
          : '/api/cron/pipeline?mode=reconcile',
      },
      {
        source: '/api/cron/settle-predictions',
        destination: isVercel
          ? `${backendUrl}/api/cron/pipeline?mode=settle`
          : '/api/cron/pipeline?mode=settle',
      },
      {
        source: '/api/performance/daily',
        destination: isVercel
          ? `${backendUrl}/api/performance?view=daily`
          : '/api/performance?view=daily',
      },
      {
        source: '/api/quota',
        destination: isVercel
          ? `${backendUrl}/api/providers?view=quota`
          : '/api/providers?view=quota',
      },
      {
        source: '/api/settlements',
        destination: isVercel
          ? `${backendUrl}/api/performance?view=settlements`
          : '/api/performance?view=settlements',
      },
      {
        source: '/api/performance/bookmakers',
        destination: isVercel
          ? `${backendUrl}/api/performance?view=bookmakers`
          : '/api/performance?view=bookmakers',
      },
      {
        source: '/api/performance/calibration',
        destination: isVercel
          ? `${backendUrl}/api/performance?view=calibration`
          : '/api/performance?view=calibration',
      },
      {
        source: '/api/performance/timeseries',
        destination: isVercel
          ? `${backendUrl}/api/performance?view=timeseries`
          : '/api/performance?view=timeseries',
      },
      {
        source: '/api/performance/markets',
        destination: isVercel
          ? `${backendUrl}/api/performance?view=markets`
          : '/api/performance?view=markets',
      },
      {
        source: '/api/performance/clv',
        destination: isVercel
          ? `${backendUrl}/api/performance?view=clv`
          : '/api/performance?view=clv',
      },
      {
        source: '/api/performance/leagues',
        destination: isVercel
          ? `${backendUrl}/api/performance?view=leagues`
          : '/api/performance?view=leagues',
      },
      {
        source: '/api/performance/summary',
        destination: isVercel
          ? `${backendUrl}/api/performance?view=summary`
          : '/api/performance?view=summary',
      },
      {
        source: '/api/cron/worldwide-scheduler',
        destination: isVercel
          ? `${backendUrl}/api/cron/pipeline`
          : '/api/cron/pipeline',
      },
      {
        source: '/api/ops/dashboard',
        destination: isVercel
          ? `${backendUrl}/api/cron/pipeline?mode=ops`
          : '/api/cron/pipeline?mode=ops',
      },
    ];

    if (isVercel || process.env.PROXY_TO_CLOUD_RUN === 'true') {
      return [
        ...internalRewrites,
        {
          source: '/api/:path*',
          destination: `${backendUrl}/api/:path*`,
        },
      ];
    }

    return internalRewrites;
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
