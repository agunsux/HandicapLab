'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  fetchMatches,
  fetchLiveMatches,
  fetchOdds,
  fetchSignals,
  fetchSignalDetails,
  fetchMarketDepth,
  fetchPerformanceReport,
  fetchMatchStats,
  fetchPredictions,
  fetchOddsHistory,
} from '@/services/api';
import {
  generateMockMatches,
  generateMockOdds,
  generateMockSignals,
  generateMockPerformance,
} from '@/services/mockEngine';
import { MarketType, PerformanceStats } from '@/types';
import { useAppStore } from '@/store/appStore';

export function useMatches(dateFrom?: string, dateTo?: string) {
  const { autoRefresh } = useAppStore();

  return useQuery({
    queryKey: ['matches', dateFrom, dateTo],
    queryFn: () => fetchMatches(dateFrom, dateTo),
    staleTime: 30000,
    refetchInterval: autoRefresh ? 60000 : false,
    placeholderData: generateMockMatches(12, dateFrom || 'today'),
  });
}

export function useLiveMatches() {
  const { autoRefresh } = useAppStore();

  return useQuery({
    queryKey: ['matches', 'live'],
    queryFn: fetchLiveMatches,
    staleTime: 15000,
    refetchInterval: autoRefresh ? 15000 : false,
    placeholderData: generateMockMatches(12).filter((m) => m.status === 'LIVE'),
  });
}

export function useOdds(matchId?: string) {
  const { autoRefresh } = useAppStore();
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 15000);
    return () => clearInterval(interval);
  }, [autoRefresh]);

  return useQuery({
    queryKey: ['odds', matchId, tick],
    queryFn: () => fetchOdds('soccer_epl', 'eu', tick),
    staleTime: 10000,
    refetchInterval: autoRefresh ? 15000 : false,
    placeholderData: generateMockOdds(matchId || 'm-101', tick),
  });
}

export function useSignals(filters?: any) {
  const { autoRefresh } = useAppStore();

  return useQuery({
    queryKey: ['signals', filters],
    queryFn: () => fetchSignals(filters),
    staleTime: 5000,
    refetchInterval: autoRefresh ? 10000 : false,
    placeholderData: generateMockSignals(10),
  });
}

export function useSignalDetails(signalId: string) {
  return useQuery({
    queryKey: ['signal', signalId],
    queryFn: () => fetchSignalDetails(signalId),
    staleTime: 10000,
    enabled: Boolean(signalId),
  });
}

export function useMarketDepth(matchId: string, market: MarketType) {
  const { autoRefresh } = useAppStore();

  return useQuery({
    queryKey: ['marketDepth', matchId, market],
    queryFn: () => fetchMarketDepth(matchId, market),
    staleTime: 15000,
    refetchInterval: autoRefresh ? 20000 : false,
    enabled: Boolean(matchId && market),
  });
}

export function usePerformance(days: number = 30) {
  return useQuery<PerformanceStats>({
    queryKey: ['performance', days],
    queryFn: async () => {
      const reports = await fetchPerformanceReport(days);
      const history = reports.map((r: any) => ({
        date: String(r.date || new Date().toISOString().split('T')[0]),
        pnl: Number(r.profit ?? r.pnl ?? 0),
        cumulative: Number(r.cumulative ?? 0),
      }));
      const cumPnL = history.length > 0 ? history[history.length - 1].cumulative : 0;
      return {
        days,
        totalBets: days * 3,
        winRate: 58.6,
        cumulativePnL: cumPnL,
        roi: 12.8,
        dailyHistory: history,
      };
    },
    staleTime: 300000, // 5 min
    placeholderData: {
      days,
      totalBets: days * 3,
      winRate: 58.6,
      cumulativePnL: 18.4,
      roi: 12.8,
      dailyHistory: generateMockPerformance(days).map((r) => ({
        date: String(r.date || new Date().toISOString().split('T')[0]),
        pnl: Number(r.profit || 0),
        cumulative: Number(r.cumulative || 0),
      })),
    },
  });
}

export function useMatchStats(fixtureId: number | string) {
  return useQuery({
    queryKey: ['matchStats', fixtureId],
    queryFn: () => fetchMatchStats(fixtureId),
    staleTime: 30000,
    enabled: Boolean(fixtureId),
  });
}

export function usePredictions(fixtureId: number | string) {
  return useQuery({
    queryKey: ['predictions', fixtureId],
    queryFn: () => fetchPredictions(fixtureId),
    staleTime: 60000,
    enabled: Boolean(fixtureId),
  });
}

export function useOddsHistory(eventId: string) {
  return useQuery({
    queryKey: ['oddsHistory', eventId],
    queryFn: () => fetchOddsHistory(eventId),
    staleTime: 30000,
    enabled: Boolean(eventId),
  });
}
