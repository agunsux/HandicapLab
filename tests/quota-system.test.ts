import { describe, it, expect, vi, beforeEach } from 'vitest';
import { supabase } from '@/lib/supabase.server';
import { reserveQuota, confirmQuota, rollbackQuota, cleanupStaleReservations } from '@/lib/providers/quotaManagerV4';

// Mock Supabase
vi.mock('@/lib/supabase.server', () => {
  return {
    supabase: {
      rpc: vi.fn(),
    },
  };
});

describe('P0-A Persistent Quota Manager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should successfully reserve quota', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        ok: true,
        reservation_id: 'res-123',
        safe_limit: 7125,
        consumed: 100,
        reserved: 1,
        safe_remaining: 7024,
      },
      error: null,
    } as any);

    const result = await reserveQuota('apifootball', 'fixtures', 100);
    expect(result.ok).toBe(true);
    expect(result.reservationId).toBe('res-123');
    // hard limit 7500 - (consumed 100 + reserved 1) = 7399
    expect(result.quotaRemaining).toBe(7399);
    expect(result.hardLimit).toBe(7500);
    expect(result.softLimit).toBe(6000);
  });

  it('should reject reservation if over limit', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        ok: false,
        reason: 'QUOTA_EXHAUSTED',
      },
      error: null,
    } as any);

    const result = await reserveQuota('apifootball', 'fixtures', 100);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('QUOTA_EXHAUSTED');
  });

  it('should reject ECONOMY mode if priority is < 40', async () => {
    // 5000 consumed >= 80% of the 6000 soft limit -> ECONOMY mode
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        ok: true,
        reservation_id: 'res-456',
        safe_limit: 7500,
        consumed: 5000,
        reserved: 1,
        safe_remaining: 2499,
      },
      error: null,
    } as any);
    // Mock rollback
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { ok: true },
      error: null,
    } as any);

    const result = await reserveQuota('apifootball', 'fixtures', 30); // P3 metadata priority
    expect(result.ok).toBe(false);
    expect(result.mode).toBe('ECONOMY');
    expect(result.reason).toContain('ECONOMY');
    
    // Should have called rollback
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(supabase.rpc).toHaveBeenNthCalledWith(2, 'rollback_quota', { p_reservation_id: 'res-456' });
  });

  it('should confirm quota with idempotency logic based on RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        ok: false,
        reason: 'ALREADY_CONFIRMED'
      },
      error: null
    } as any);

    const result = await confirmQuota('res-123', 1);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('ALREADY_CONFIRMED');
  });

  it('should reject rollback after confirm', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {
        ok: false,
        reason: 'ALREADY_CONFIRMED'
      },
      error: null
    } as any);

    const result = await rollbackQuota('res-123');
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('ALREADY_CONFIRMED');
  });

  it('should handle provider isolation properly by sending correct arguments', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { ok: true, reservation_id: 'res-oddspapi' },
      error: null
    } as any);

    await reserveQuota('oddspapi', 'odds', 100);
    
    // OddsPAPI is monthly: hard 250 (provider contract), soft 200 (app policy).
    expect(supabase.rpc).toHaveBeenCalledWith('reserve_quota', expect.objectContaining({
      p_provider: 'oddspapi',
      p_quota_type: 'MONTHLY',
      p_default_limit: 250,
      p_safety_reserve_pct: 0
    }));
  });

  it('should execute stale cleanup via RPC', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: null
    } as any);

    await cleanupStaleReservations(5);
    expect(supabase.rpc).toHaveBeenCalledWith('cleanup_stale_reservations', { p_stale_minutes: 5 });
  });
});
