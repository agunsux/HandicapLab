'use client';

import { useState, useEffect } from 'react';
import {
  fetchMatches,
  fetchLiveMatches,
  fetchOdds,
  fetchSignals,
  fetchSignalDetails,
  fetchMarketDepth,
  fetchPerformance,
} from '@/services/api';
import { Match, MatchOdds, Signal, MarketDepth, PerformanceStats } from '@/types';
import { useAppStore } from '@/store/appStore';

export function useMatches(dateFrom?: string, dateTo?: string) {
  const [data, setData] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const { autoRefresh } = useAppStore();

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const result = await fetchMatches(dateFrom, dateTo);
        if (mounted) {
          setData(result);
          setIsLoading(false);
        }
      } catch (err: any) {
        if (mounted) {
          setError(err);
          setIsLoading(false);
        }
      }
    }

    load();

    if (!autoRefresh) return;
    const interval = setInterval(load, 60000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [dateFrom, dateTo, autoRefresh]);

  return { data, isLoading, error };
}

export function useLiveMatches() {
  const [data, setData] = useState<Match[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { autoRefresh } = useAppStore();

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const result = await fetchLiveMatches();
        if (mounted) {
          setData(result);
          setIsLoading(false);
        }
      } catch {
        if (mounted) setIsLoading(false);
      }
    }

    load();

    if (!autoRefresh) return;
    const interval = setInterval(load, 15000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [autoRefresh]);

  return { data, isLoading };
}

export function useOdds(matchId?: string) {
  const [data, setData] = useState<MatchOdds[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { autoRefresh } = useAppStore();

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const result = await fetchOdds(matchId);
        if (mounted) {
          setData(result);
          setIsLoading(false);
        }
      } catch {
        if (mounted) setIsLoading(false);
      }
    }

    load();

    if (!autoRefresh) return;
    const interval = setInterval(load, 30000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [matchId, autoRefresh]);

  return { data, isLoading };
}

export function useSignals(filters?: { market?: string; minEv?: number }) {
  const [data, setData] = useState<Signal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { autoRefresh } = useAppStore();

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const result = await fetchSignals(filters);
        if (mounted) {
          setData(result);
          setIsLoading(false);
        }
      } catch {
        if (mounted) setIsLoading(false);
      }
    }

    load();

    if (!autoRefresh) return;
    const interval = setInterval(load, 10000); // Fast 10s polling
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [JSON.stringify(filters), autoRefresh]);

  return { data, isLoading };
}

export function useSignalDetails(signalId: string) {
  const [data, setData] = useState<Signal | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const result = await fetchSignalDetails(signalId);
        if (mounted) {
          setData(result);
          setIsLoading(false);
        }
      } catch {
        if (mounted) setIsLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [signalId]);

  return { data, isLoading };
}

export function useMarketDepth(matchId: string, market: string) {
  const [data, setData] = useState<MarketDepth | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { autoRefresh } = useAppStore();

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const result = await fetchMarketDepth(matchId, market);
        if (mounted) {
          setData(result);
          setIsLoading(false);
        }
      } catch {
        if (mounted) setIsLoading(false);
      }
    }

    load();

    if (!autoRefresh) return;
    const interval = setInterval(load, 20000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [matchId, market, autoRefresh]);

  return { data, isLoading };
}

export function usePerformance(days: number = 30) {
  const [data, setData] = useState<PerformanceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const result = await fetchPerformance(days);
        if (mounted) {
          setData(result);
          setIsLoading(false);
        }
      } catch {
        if (mounted) setIsLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [days]);

  return { data, isLoading };
}
