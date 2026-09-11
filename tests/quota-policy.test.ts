import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  getProviderQuotaPolicy,
  evaluateQuotaPressure,
  isPriorityAllowed,
  quotaStatusLabel,
  isUnmeteredEndpoint,
  QUOTA_PRIORITY,
} from '@/lib/providers/quotaPolicy';

describe('quotaPolicy — canonical provider limits', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to API-Football PRO: hard 7,500/day, soft 6,000/day', () => {
    vi.stubEnv('API_FOOTBALL_DAILY_HARD_LIMIT', '');
    vi.stubEnv('API_FOOTBALL_DAILY_SOFT_LIMIT', '');
    vi.stubEnv('QUOTA_APIFOOTBALL_DAILY', '');

    const policy = getProviderQuotaPolicy('apifootball');
    expect(policy.period).toBe('DAILY');
    expect(policy.hardLimit).toBe(7500);
    expect(policy.softLimit).toBe(6000);
  });

  it('defaults to OddsPapi: hard 250/month, soft 200/month', () => {
    vi.stubEnv('ODDSPAPI_HARD_LIMIT', '');
    vi.stubEnv('ODDSPAPI_SOFT_LIMIT', '');
    vi.stubEnv('QUOTA_ODDSPAPI_MONTHLY', '');

    const policy = getProviderQuotaPolicy('oddspapi');
    expect(policy.period).toBe('MONTHLY');
    expect(policy.hardLimit).toBe(250);
    expect(policy.softLimit).toBe(200);
  });

  it('supports env overrides and clamps the soft limit to the hard limit', () => {
    vi.stubEnv('API_FOOTBALL_DAILY_HARD_LIMIT', '500');
    vi.stubEnv('API_FOOTBALL_DAILY_SOFT_LIMIT', '900');

    const policy = getProviderQuotaPolicy('apifootball');
    expect(policy.hardLimit).toBe(500);
    expect(policy.softLimit).toBe(500);
  });

  it('transitions NORMAL → ECONOMY → CRITICAL → QUOTA_EXHAUSTED', () => {
    vi.stubEnv('API_FOOTBALL_DAILY_HARD_LIMIT', '');
    vi.stubEnv('API_FOOTBALL_DAILY_SOFT_LIMIT', '');
    vi.stubEnv('QUOTA_APIFOOTBALL_DAILY', '');
    const policy = getProviderQuotaPolicy('apifootball');

    expect(evaluateQuotaPressure(policy, 0).mode).toBe('NORMAL');
    expect(evaluateQuotaPressure(policy, 4799).mode).toBe('NORMAL');
    expect(evaluateQuotaPressure(policy, 4800).mode).toBe('ECONOMY'); // 80% of soft
    expect(evaluateQuotaPressure(policy, 6000).mode).toBe('CRITICAL'); // soft limit
    expect(evaluateQuotaPressure(policy, 7500).mode).toBe('QUOTA_EXHAUSTED'); // hard limit
    expect(evaluateQuotaPressure(policy, 8000).exhausted).toBe(true);
  });

  it('applies the same soft/hard semantics to OddsPapi (200/250)', () => {
    vi.stubEnv('ODDSPAPI_HARD_LIMIT', '');
    vi.stubEnv('ODDSPAPI_SOFT_LIMIT', '');
    vi.stubEnv('QUOTA_ODDSPAPI_MONTHLY', '');
    const policy = getProviderQuotaPolicy('oddspapi');

    expect(evaluateQuotaPressure(policy, 159).mode).toBe('NORMAL');
    expect(evaluateQuotaPressure(policy, 160).mode).toBe('ECONOMY'); // 80% of soft
    expect(evaluateQuotaPressure(policy, 200).mode).toBe('CRITICAL'); // soft limit
    expect(evaluateQuotaPressure(policy, 250).mode).toBe('QUOTA_EXHAUSTED'); // hard limit
    expect(isPriorityAllowed(evaluateQuotaPressure(policy, 250).mode, 100)).toBe(false);
  });

  it('gates priorities per pressure mode', () => {
    expect(isPriorityAllowed('NORMAL', 0)).toBe(true);
    expect(isPriorityAllowed('ECONOMY', QUOTA_PRIORITY.P3_METRICS)).toBe(false);
    expect(isPriorityAllowed('ECONOMY', QUOTA_PRIORITY.P2_HISTORICAL)).toBe(true);
    expect(isPriorityAllowed('CRITICAL', QUOTA_PRIORITY.P1_SNAPSHOT)).toBe(false);
    expect(isPriorityAllowed('CRITICAL', QUOTA_PRIORITY.P0_PREDICTION)).toBe(true);
    expect(isPriorityAllowed('QUOTA_EXHAUSTED', QUOTA_PRIORITY.P0_SETTLEMENT)).toBe(false);
  });

  it('labels OddsPapi protection states distinctly', () => {
    expect(quotaStatusLabel('oddspapi', 'CRITICAL')).toBe('ODDS_QUOTA_PROTECTION');
    expect(quotaStatusLabel('oddspapi', 'QUOTA_EXHAUSTED')).toBe('ODDS_QUOTA_EXHAUSTED');
    expect(quotaStatusLabel('apifootball', 'QUOTA_EXHAUSTED')).toBe('QUOTA_EXHAUSTED');
    expect(quotaStatusLabel('apifootball', 'NORMAL')).toBe('NORMAL');
  });

  it('knows which endpoints are unmetered', () => {
    expect(isUnmeteredEndpoint('oddspapi', 'historical-odds')).toBe(true);
    expect(isUnmeteredEndpoint('oddspapi', '/v4/historical-odds')).toBe(true);
    expect(isUnmeteredEndpoint('oddspapi', '/v4/account')).toBe(true);
    expect(isUnmeteredEndpoint('oddspapi', 'odds-by-tournaments')).toBe(false);
    expect(isUnmeteredEndpoint('apifootball', 'fixtures')).toBe(false);
  });
});
