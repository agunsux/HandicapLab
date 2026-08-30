'use client';

import { useState, useEffect } from 'react';
import { UserTier, MarketType, OddsFormat } from '@/types';

export interface AppState {
  userTier: UserTier;
  selectedMarkets: MarketType[];
  selectedLeagues: string[];
  oddsFormat: OddsFormat;
  autoRefresh: boolean;
  watchlist: string[];
  sidebarOpen: boolean;
  activePage: string;
}

const STORAGE_KEY = 'sth-storage';

const defaultState: AppState = {
  userTier: 'free',
  selectedMarkets: ['asian_handicap', 'over_under', 'btts'],
  selectedLeagues: [],
  oddsFormat: 'decimal',
  autoRefresh: true,
  watchlist: [],
  sidebarOpen: false,
  activePage: 'dashboard',
};

type Listener = () => void;
const listeners: Set<Listener> = new Set();

let currentState: AppState = (() => {
  if (typeof window === 'undefined') return defaultState;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...defaultState, ...JSON.parse(saved) } : defaultState;
  } catch {
    return defaultState;
  }
})();

function emitChange() {
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
    } catch {}
  }
  listeners.forEach((listener) => listener());
}

export const appStore = {
  getState: () => currentState,

  subscribe: (listener: Listener) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  setUserTier: (userTier: UserTier) => {
    currentState = { ...currentState, userTier };
    emitChange();
  },

  toggleMarket: (market: MarketType) => {
    const exists = currentState.selectedMarkets.includes(market);
    const selectedMarkets = exists
      ? currentState.selectedMarkets.filter((m) => m !== market)
      : [...currentState.selectedMarkets, market];
    currentState = { ...currentState, selectedMarkets };
    emitChange();
  },

  toggleLeague: (league: string) => {
    const exists = currentState.selectedLeagues.includes(league);
    const selectedLeagues = exists
      ? currentState.selectedLeagues.filter((l) => l !== league)
      : [...currentState.selectedLeagues, league];
    currentState = { ...currentState, selectedLeagues };
    emitChange();
  },

  setOddsFormat: (oddsFormat: OddsFormat) => {
    currentState = { ...currentState, oddsFormat };
    emitChange();
  },

  setAutoRefresh: (autoRefresh: boolean) => {
    currentState = { ...currentState, autoRefresh };
    emitChange();
  },

  addToWatchlist: (matchId: string) => {
    if (!currentState.watchlist.includes(matchId)) {
      currentState = { ...currentState, watchlist: [...currentState.watchlist, matchId] };
      emitChange();
    }
  },

  removeFromWatchlist: (matchId: string) => {
    currentState = {
      ...currentState,
      watchlist: currentState.watchlist.filter((id) => id !== matchId),
    };
    emitChange();
  },

  setSidebarOpen: (sidebarOpen: boolean) => {
    currentState = { ...currentState, sidebarOpen };
    emitChange();
  },

  setActivePage: (activePage: string) => {
    currentState = { ...currentState, activePage };
    emitChange();
  },
};

export function useAppStore() {
  const [state, setState] = useState<AppState>(appStore.getState());

  useEffect(() => {
    const unsubscribe = appStore.subscribe(() => {
      setState(appStore.getState());
    });
    return () => {
      unsubscribe();
    };
  }, []);

  return {
    ...state,
    setUserTier: appStore.setUserTier,
    toggleMarket: appStore.toggleMarket,
    toggleLeague: appStore.toggleLeague,
    setOddsFormat: appStore.setOddsFormat,
    setAutoRefresh: appStore.setAutoRefresh,
    addToWatchlist: appStore.addToWatchlist,
    removeFromWatchlist: appStore.removeFromWatchlist,
    setSidebarOpen: appStore.setSidebarOpen,
    setActivePage: appStore.setActivePage,
  };
}
