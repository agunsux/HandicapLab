// HandicapLab / SALMO.DEV - Live Production Daily Picks Page
// Location: src/app/daily-picks/page.tsx
// Invariant: Zero mock data, real-time live pipeline, fail-closed on data unavailability.

import { Metadata } from 'next';
import { DailyPicksEngine } from '@/lib/daily-picks/engine';
import { DailyPicksClient } from './DailyPicksClient';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Daily Picks & Predictions — SALMO.DEV | Real-Time Market Intelligence',
  description:
    'Real-time Premier League quantitative predictions evaluated against live Pinnacle market odds across Asian Handicap, Over/Under, and BTTS. Audited ledger provenance and zero mock data.',
  alternates: {
    canonical: 'https://salmo.dev/daily-picks',
  },
};

export default async function DailyPicksPage() {
  // Pre-load live daily picks on the server side (strictly read-only, no provider calls triggered by SSR)
  const initialData = await DailyPicksEngine.getDailyPicks({ forceRefresh: false, allowProviderCalls: false }).catch(() => ({
    success: false,
    count: 0,
    dataState: 'DATA_UNAVAILABLE' as const,
    picks: [],
    meta: {
      asOfUtc: new Date().toISOString(),
      freshnessMinutesAgo: 0,
      window: '24h',
      canonicalDomain: 'salmo.dev' as const,
      quotaState: {
        apiFootball: { remaining: 0, status: 'UNKNOWN' },
        oddsPapi: { remaining: 0, status: 'PAUSED' },
      },
    },
    message: 'Data temporarily unavailable during static build.',
  }));

  return <DailyPicksClient initialData={initialData} />;
}
