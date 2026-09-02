import React from 'react';
import { getDashboardPerformance } from '@/lib/dashboardPerformance';
import { UserDashboardView } from '@/components/dashboard/UserDashboardView';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Personal Performance Dashboard — HandicapLab',
  description: 'Track your personal performance, win rate, yield, and outcomes across Asian Handicap, Over/Under, and BTTS.',
};

export default async function AppDashboardPage() {
  const perf = await getDashboardPerformance();

  return (
    <div className="flex flex-col min-h-screen bg-[#0B0F0E]">
      <UserDashboardView perf={perf} />
    </div>
  );
}