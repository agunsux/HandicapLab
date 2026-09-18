// HandicapLab / SALMO.DEV - Live Production Daily Picks Page
// Location: src/app/daily-picks/page.tsx
// Invariant: Zero mock data, real-time live pipeline, fail-closed on data unavailability.

import { Metadata } from 'next';
import { DailyPicksEngine } from '@/lib/daily-picks/engine';
import { DailyPicksClient } from './DailyPicksClient';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Daily Picks & Predictions — SALMO.DEV | Real-Time Market Intelligence',
  description:
    'Real-time Premier League quantitative predictions evaluated against live Pinnacle market odds across Asian Handicap, Over/Under, and BTTS. Audited ledger provenance and zero mock data.',
  alternates: {
    canonical: 'https://salmo.dev/daily-picks',
  },
};

export default async function DailyPicksPage() {
  // Pre-load live daily picks on the server side
  const initialData = await DailyPicksEngine.getDailyPicks({ forceRefresh: false });

  return <DailyPicksClient initialData={initialData} />;
}
