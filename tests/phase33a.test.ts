import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as preferencesGET, POST as preferencesPOST } from '../src/app/api/user/preferences/route';
import { GET as watchlistGET, POST as watchlistPOST, DELETE as watchlistDELETE } from '../src/app/api/watchlist/route';
import { GET as feedGET } from '../src/app/api/signals/feed/route';
import { GET as digestGET } from '../src/app/api/cron/daily-digest/route';
import { maskSignalData } from '../src/lib/signals/visibility';
import { supabase } from '../src/lib/supabase.server';

// Mock Entitlements checking helper
const mockEntitlement = vi.hoisted(() => ({ active: false }));
vi.mock('../src/lib/payments/entitlement/check', () => ({
  checkActiveEntitlement: async () => mockEntitlement.active
}));

// Mock Database Stores
let mockPreferencesStore: any = null;
let mockWatchlistStore: any[] = [];
let mockEventsStore: any[] = [];
let mockSignalsStore: any[] = [];

// Mock Supabase Server Client
vi.mock('../src/lib/supabase.server', () => {
  const chain: any = {
    select: vi.fn().mockImplementation(() => chain),
    eq: vi.fn().mockImplementation(() => chain),
    not: vi.fn().mockImplementation(() => chain),
    order: vi.fn().mockImplementation(() => chain),
    limit: vi.fn().mockImplementation(() => chain),
    in: vi.fn().mockImplementation(() => chain),
    lt: vi.fn().mockImplementation(() => chain),
    is: vi.fn().mockImplementation(() => chain),
    or: vi.fn().mockImplementation(() => chain),
    insert: vi.fn().mockImplementation((payload) => {
      const array = Array.isArray(payload) ? payload : [payload];
      for (const item of array) {
        if (chain._currentTable === 'signal_events') {
          mockEventsStore.push(item);
        }
      }
      return chain;
    }),
    update: vi.fn().mockImplementation(() => chain),
    upsert: vi.fn().mockImplementation((payload) => {
      const array = Array.isArray(payload) ? payload : [payload];
      for (const item of array) {
        if (chain._currentTable === 'user_preferences') {
          mockPreferencesStore = { ...mockPreferencesStore, ...item };
        } else if (chain._currentTable === 'watchlists') {
          mockWatchlistStore.push(item);
        }
      }
      return chain;
    }),
    delete: vi.fn().mockImplementation(() => chain),
    gt: vi.fn().mockImplementation(() => chain),
    maybeSingle: vi.fn().mockImplementation(() => {
      if (chain._currentTable === 'user_preferences') {
        return Promise.resolve({ data: mockPreferencesStore, error: null });
      }
      if (chain._currentTable === 'signals') {
        return Promise.resolve({ data: mockSignalsStore[0] || null, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }),
    single: vi.fn().mockImplementation(() => {
      if (chain._currentTable === 'user_preferences') {
        return Promise.resolve({ data: mockPreferencesStore, error: null });
      }
      if (chain._currentTable === 'watchlists') {
        return Promise.resolve({ data: mockWatchlistStore[mockWatchlistStore.length - 1], error: null });
      }
      return Promise.resolve({ data: null, error: null });
    }),
    then: vi.fn().mockImplementation((resolve) => {
      if (chain._currentTable === 'signals') {
        resolve({ data: mockSignalsStore, error: null });
      } else if (chain._currentTable === 'watchlists') {
        resolve({ data: mockWatchlistStore, error: null });
      } else {
        resolve({ data: [], error: null });
      }
    })
  };

  return {
    supabase: {
      from: vi.fn((table: string) => {
        chain._currentTable = table;
        return chain;
      }),
      rpc: vi.fn()
    }
  };
});

describe('Phase 33A: Retention Core Layer Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPreferencesStore = null;
    mockWatchlistStore = [];
    mockEventsStore = [];
    mockSignalsStore = [];
    mockEntitlement.active = false;
  });

  describe('Part 1 & 2: Preferences & Watchlist CRUD', () => {
    it('should save and retrieve user preferences', async () => {
      const postReq = new Request('http://localhost/api/user/preferences', {
        method: 'POST',
        headers: {
          'x-user-id': 'user_123',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          preferred_markets: ['Asian Handicap'],
          preferred_competitions: ['Premier League'],
          minimum_confidence: 80,
          minimum_edge: 2.5
        })
      });

      const postRes = await preferencesPOST(postReq);
      expect(postRes.status).toBe(200);
      const postJson = await postRes.json();
      expect(postJson.success).toBe(true);
      expect(postJson.preferences.minimum_confidence).toBe(80);

      // Verify Retrieve GET
      const getReq = new Request('http://localhost/api/user/preferences', {
        headers: { 'x-user-id': 'user_123' }
      });
      const getRes = await preferencesGET(getReq);
      expect(getRes.status).toBe(200);
      const getJson = await getRes.json();
      expect(getJson.success).toBe(true);
      expect(getJson.preferences.preferred_markets).toContain('Asian Handicap');
    });

    it('should support Watchlist CRUD actions (add, list, remove)', async () => {
      const postReq = new Request('http://localhost/api/watchlist', {
        method: 'POST',
        headers: {
          'x-user-id': 'user_123',
          'content-type': 'application/json'
        },
        body: JSON.stringify({ type: 'team', entity_id: 'Arsenal' })
      });

      const postRes = await watchlistPOST(postReq);
      expect(postRes.status).toBe(200);
      const postJson = await postRes.json();
      expect(postJson.success).toBe(true);
      expect(postJson.watchlist.entity_id).toBe('Arsenal');

      // Verify List GET
      const getReq = new Request('http://localhost/api/watchlist', {
        headers: { 'x-user-id': 'user_123' }
      });
      const getRes = await watchlistGET(getReq);
      const getJson = await getRes.json();
      expect(getJson.success).toBe(true);
      expect(getJson.watchlists).toHaveLength(1);

      // Verify Remove DELETE
      const deleteReq = new Request('http://localhost/api/watchlist', {
        method: 'DELETE',
        headers: {
          'x-user-id': 'user_123',
          'content-type': 'application/json'
        },
        body: JSON.stringify({ type: 'team', entity_id: 'Arsenal' })
      });
      const deleteRes = await watchlistDELETE(deleteReq);
      expect(deleteRes.status).toBe(200);
    });
  });

  describe('Part 3: Personalized Signal Feed', () => {
    it('should prioritize and sort matching preference signals above others', async () => {
      // Mock Preferences: User likes Premier League AH
      mockPreferencesStore = {
        user_id: 'user_123',
        preferred_markets: ['Asian Handicap'],
        preferred_competitions: ['Premier League'],
        minimum_confidence: 70,
        minimum_edge: 2.0
      };

      // Mock signals: One matching, one unrelated
      mockSignalsStore = [
        {
          id: 'unrelated_sig',
          league: 'La Liga',
          market: 'moneyline',
          confidence: 0.75,
          edge_pct: 3.5,
          status: 'OPEN'
        },
        {
          id: 'preferred_sig',
          league: 'Premier League',
          market: 'asian_handicap',
          confidence: 0.85,
          edge_pct: 4.0,
          status: 'OPEN'
        }
      ];

      const request = new Request('http://localhost/api/signals/feed');
      request.headers.set('x-user-id', 'user_123');

      const response = await feedGET(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);

      // preferred_sig should sort first due to preference matching boost
      expect(json.feed[0].id).toBe('preferred_sig');
      expect(json.feed[1].id).toBe('unrelated_sig');
    });
  });

  describe('Part 4 & 5 & 6: Events, Alert Service & Daily Digest', () => {
    it('should successfully run digest cron returning digestsCount', async () => {
      mockSignalsStore = [
        { id: 'sig_1', home_team: 'USA', away_team: 'Mexico', league: 'FIFA World Cup', market: 'moneyline', odds: 1.85, confidence: 0.82 }
      ];

      const request = new Request('http://localhost/api/cron/daily-digest', {
        headers: { authorization: `Bearer test_cron_secret` }
      });
      process.env.CRON_SECRET = 'test_cron_secret';

      const response = await digestGET(request);
      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.digestsSent).toBe(2); // sends to 2 mock users
    });
  });

  describe('Part 7: Premium Visibility Masking Regression Tests', () => {
    it('should mask odds, recommended stake, probability, selection, and explanation for free tier users', () => {
      const rawSignal = {
        id: 'sig_123',
        prediction: {
          market: 'asian_handicap',
          selection: 'home_-0.5',
          odds: 1.95,
          probability: 0.55,
          recommended_stake: 0.025,
          explanation: 'Model Poissons predict edge on Arsenal.',
          general_explanation: 'Standard strength indicators.'
        },
        market_movement: {
          opening_odds: 1.95,
          current_odds: 2.05
        }
      };

      // Free user masking
      const freeResult = maskSignalData(rawSignal, false);
      expect(freeResult.prediction.selection).toBeNull();
      expect(freeResult.prediction.odds).toBeNull();
      expect(freeResult.prediction.probability).toBeNull();
      expect(freeResult.prediction.recommended_stake).toBeNull();
      expect(freeResult.prediction.explanation).toBeNull();
      expect(freeResult.prediction.general_explanation).toBe('Standard strength indicators.');

      // Premium user gets all fields unmasked
      const premiumResult = maskSignalData(rawSignal, true);
      expect(premiumResult.prediction.selection).toBe('home_-0.5');
      expect(premiumResult.prediction.odds).toBe(1.95);
      expect(premiumResult.prediction.probability).toBe(0.55);
      expect(premiumResult.prediction.recommended_stake).toBe(0.025);
      expect(premiumResult.prediction.explanation).toBe('Model Poissons predict edge on Arsenal.');
    });
  });
});
