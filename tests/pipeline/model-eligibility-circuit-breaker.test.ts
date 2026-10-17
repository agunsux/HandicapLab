import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConfidenceGateSystem, ConfidenceGateInput } from '@/lib/pipeline/confidenceGate';
import { toDailyPicksRow } from '@/lib/durability/productionDurableState';
import { GET as ahGET } from '@/app/api/v1/markets/asian-handicap/route';
import { GET as publicPredsGET } from '@/app/api/public/predictions/route';
import { supabase } from '@/lib/supabase.server';

const createMockChain = (data: any[] = [], error: any = null) => {
  const chain: any = {
    select: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    gt: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: (resolve: any) => resolve({ data, error }),
  };
  return chain;
};

vi.mock('@/lib/supabase.server', () => {
  return {
    supabase: {
      from: vi.fn(),
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    },
  };
});

vi.mock('@/lib/pricing/entitlement', () => {
  return {
    getUserEntitlements: vi.fn().mockResolvedValue({ hasFullEdgeData: false }),
  };
});

describe('Fail-Closed Model Eligibility Circuit Breaker (Section P0 Invariants)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseKickoff = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
  const basePredictionTime = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const baseOddsTime = new Date(Date.now() - 10 * 60 * 1000).toISOString();

  // Baseline valid input
  const validAhInput: ConfidenceGateInput = {
    canonicalMatchId: 'EPL_2025_ARSENAL_CHELSEA_2026-09-28',
    fixtureId: 'ac3b6909-9417-5b2f-beb1-38c6a54b111d',
    match: 'Arsenal vs Chelsea',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    competition: 'Premier League',
    kickoffUtc: baseKickoff,
    market: 'AH',
    selection: 'Arsenal -0.5',
    line: -0.5,
    odds: 1.85,
    modelProbability: 0.68,
    calibratedProbability: 0.68,
    predictionTimestampUtc: basePredictionTime,
    oddsTimestampUtc: baseOddsTime,
    modelVersion: 'dixon-coles-v1.0',
    sampleSizeHome: 10,
    sampleSizeAway: 10,
    modelValidated: true,
    isStaticFallback: false,
  };

  // ─── 1. STATIC FALLBACK XG REJECTION ─────────────────────────────────────
  it('1. Rejects static fallback xG even when probability and EV are artificially high (The 70.64% Pilot Defect)', () => {
    // Exact simulation of the pilot failure mode:
    // Model evaluated with uncalibrated fallback parameters (1.45/1.15) giving 70.64% prob against odds 2.05 (+44.8% EV)
    const staticFallbackInput: ConfidenceGateInput = {
      ...validAhInput,
      homeTeam: 'Nottingham Forest',
      awayTeam: 'Arsenal',
      selection: 'Nottingham Forest +0.75',
      line: 0.75,
      odds: 2.05,
      modelProbability: 0.7064,
      calibratedProbability: 0.7064,
      sampleSizeHome: 0,
      sampleSizeAway: 0,
      modelValidated: false,
      isStaticFallback: true,
      dataWarnings: ['STATIC_FALLBACK_XG_ACTIVE', 'INSUFFICIENT_TEAM_RATINGS'],
    };

    const result = ConfidenceGateSystem.evaluate(staticFallbackInput);

    expect(result.status).toBe('INSUFFICIENT_MODEL');
    expect(result.verdict).toBe('LEWATI');
    expect(result.qualified).toBe(false);
    expect(result.isHighConfidence).toBe(false);
    expect(result.confidenceTier).toBe('PASS');
    expect(result.confidenceScore).toBe(0);
    expect(result.passes.modelValidated).toBe(false);
    expect(result.rejectionReasons.some((r) => r.includes('INSUFFICIENT_MODEL'))).toBe(true);
    expect(result.rejectionReasons.some((r) => r.includes('Static fallback xG active'))).toBe(true);

    // Mathematical values still computed for audit
    expect(result.modelProbability).toBe(0.7064);
    expect(result.expectedValue).toBeGreaterThan(0.40);
  });

  // ─── 2. INSUFFICIENT SAMPLE SIZE REJECTION ──────────────────────────────
  it('2. Fails closed to INSUFFICIENT_MODEL when dynamic sample size is below minimum (< 5 matches)', () => {
    const lowSampleInput: ConfidenceGateInput = {
      ...validAhInput,
      sampleSizeHome: 3,
      sampleSizeAway: 12,
      modelValidated: true,
      isStaticFallback: false,
    };

    const result = ConfidenceGateSystem.evaluate(lowSampleInput);

    expect(result.status).toBe('INSUFFICIENT_MODEL');
    expect(result.verdict).toBe('LEWATI');
    expect(result.qualified).toBe(false);
    expect(result.isHighConfidence).toBe(false);
    expect(result.confidenceScore).toBe(0);
    expect(result.passes.sufficientSample).toBe(false);
    expect(result.rejectionReasons.some((r) => r.includes('INSUFFICIENT_MODEL: Insufficient sample size'))).toBe(true);
  });

  // ─── 3. UNVALIDATED MODEL REJECTION ─────────────────────────────────────
  it('3. Fails closed to INSUFFICIENT_MODEL when modelValidated is explicitly false', () => {
    const unvalidatedInput: ConfidenceGateInput = {
      ...validAhInput,
      modelValidated: false,
      isStaticFallback: false,
    };

    const result = ConfidenceGateSystem.evaluate(unvalidatedInput);

    expect(result.status).toBe('INSUFFICIENT_MODEL');
    expect(result.verdict).toBe('LEWATI');
    expect(result.qualified).toBe(false);
    expect(result.isHighConfidence).toBe(false);
    expect(result.confidenceScore).toBe(0);
    expect(result.passes.modelValidated).toBe(false);
    expect(result.rejectionReasons.some((r) => r.includes('INSUFFICIENT_MODEL: Model failed validation gate'))).toBe(true);
  });

  // ─── 4. VALID DYNAMIC RATINGS PASS ──────────────────────────────────────
  it('4. Allows valid dynamic model with sufficient sample size and positive EV to qualify', () => {
    const result = ConfidenceGateSystem.evaluate(validAhInput);

    expect(result.status).toBe('HIGH_CONFIDENCE');
    expect(result.verdict).toBe('LAYAK');
    expect(result.qualified).toBe(true);
    expect(result.isHighConfidence).toBe(true);
    expect(result.confidenceTier).toBe('HIGH');
    expect(result.confidenceScore).toBeGreaterThanOrEqual(70);
  });

  // ─── 5. DURABLE STATE ROW PERSISTENCE MAPPING ───────────────────────────
  it('5. toDailyPicksRow sets rejection_reason and verdict LEWATI for INSUFFICIENT_MODEL records', () => {
    const insufficientRecord: any = {
      predictionId: 'dpred_insufficient_123',
      canonicalMatchId: 'b988cd2585227775',
      match: 'Nottingham Forest vs Arsenal',
      homeTeam: 'Nottingham Forest',
      awayTeam: 'Arsenal',
      competition: 'Premier League',
      market: 'AH',
      selection: 'Nottingham Forest +0.75',
      line: 0.75,
      modelProbability: 0.7064,
      calibratedProbability: 0.7064,
      odds: 2.05,
      impliedProbability: 0.4878,
      edge: 0.2186,
      expectedValue: 0.4481,
      confidence: 'PASS',
      confidenceScore: 0,
      predictionTimestamp: basePredictionTime,
      kickoffTimestamp: baseKickoff,
      oddsTimestamp: baseOddsTime,
      modelVersion: 'dixon-coles-v1.0',
      featureVersion: 'prematch-features-v1.0',
      runId: 'daily-run-test',
      status: 'INSUFFICIENT_MODEL',
    };

    const row = toDailyPicksRow(insufficientRecord, 'daily-run-test');

    expect(row).not.toBeNull();
    expect(row!.verdict).toBe('LEWATI');
    expect(row!.rejection_reason).toBe('INSUFFICIENT_MODEL: Static fallback xG or insufficient sample');
    expect(row!.confidence).toBe(0);
  });

  // ─── 6. DIRECT PUBLIC API EXCLUSION ─────────────────────────────────────
  it('6. Public market routes exclude records with rejection_reason or verdict LEWATI', async () => {
    const validRow = {
      id: 'pick-valid-1',
      home_team: 'Arsenal',
      away_team: 'Chelsea',
      league: 'Premier League',
      kickoff_utc: baseKickoff,
      market_type: 'ASIAN_HANDICAP',
      prediction: 'Arsenal -0.5',
      model_probability: 0.68,
      market_odds: 1.85,
      edge_pct: 12.5,
      verdict: 'LAYAK',
      rejection_reason: null,
    };

    const quarantinedRow = {
      id: 'cbd13e02-6be4-4b22-95d9-59c26eb603bc',
      home_team: 'Nottingham Forest',
      away_team: 'Arsenal',
      league: 'Premier League',
      kickoff_utc: baseKickoff,
      market_type: 'ASIAN_HANDICAP',
      prediction: 'Nottingham Forest +0.75',
      model_probability: 0.7064,
      market_odds: 2.05,
      edge_pct: 21.86,
      verdict: 'LEWATI',
      rejection_reason: 'INSUFFICIENT_MODEL: Static fallback xG active',
    };

    const chain = createMockChain([quarantinedRow, validRow]);
    vi.mocked(supabase.from).mockReturnValue(chain);

    const req = new Request('http://localhost/api/v1/markets/asian-handicap?date=all');
    const res = await ahGET(req);
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.count).toBe(1);
    expect(json.data[0].id).toBe('pick-valid-1');
    expect(json.data.some((d: any) => d.id === 'cbd13e02-6be4-4b22-95d9-59c26eb603bc')).toBe(false);
  });

  it('7. /api/public/predictions excludes records with rejection_reason or verdict LEWATI', async () => {
    const validRow = {
      id: 'pred-valid-1',
      fixture_id: 'fix-1',
      league: 'Premier League',
      kickoff_utc: baseKickoff,
      home_team: 'Arsenal',
      away_team: 'Chelsea',
      market_type: 'ASIAN_HANDICAP',
      prediction: 'Arsenal -0.5',
      model_probability: 0.68,
      market_odds: 1.85,
      verdict: 'LAYAK',
      rejection_reason: null,
    };

    const quarantinedRow = {
      id: 'cbd13e02-6be4-4b22-95d9-59c26eb603bc',
      fixture_id: 'fix-2',
      league: 'Premier League',
      kickoff_utc: baseKickoff,
      home_team: 'Nottingham Forest',
      away_team: 'Arsenal',
      market_type: 'ASIAN_HANDICAP',
      prediction: 'Nottingham Forest +0.75',
      model_probability: 0.7064,
      market_odds: 2.05,
      verdict: 'LEWATI',
      rejection_reason: 'INSUFFICIENT_MODEL: Static fallback xG active',
    };

    const chain = createMockChain([quarantinedRow, validRow]);
    vi.mocked(supabase.from).mockReturnValue(chain);

    const res = await publicPredsGET();
    const json = await res.json();

    expect(json.predictions).toHaveLength(1);
    expect(json.predictions[0].id).toBe('pred-valid-1');
    expect(json.predictions.some((p: any) => p.id === 'cbd13e02-6be4-4b22-95d9-59c26eb603bc')).toBe(false);
  });
});
