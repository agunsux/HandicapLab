import { describe, it, expect, vi, beforeEach } from 'vitest';
import crypto from 'crypto';

// Mock Supabase on both the relative path and alias path using globalThis inside factory
vi.mock('../src/lib/supabase.server', () => {
  const select = vi.fn();
  const eq = vi.fn();
  const maybeSingle = vi.fn();
  const single = vi.fn();
  const insert = vi.fn();
  const update = vi.fn();
  const then = vi.fn();
  const rpc = vi.fn();

  const mockChainObj: any = {
    select,
    eq,
    maybeSingle,
    single,
    insert,
    update,
    then
  };

  select.mockReturnValue(mockChainObj);
  eq.mockReturnValue(mockChainObj);
  insert.mockReturnValue(mockChainObj);
  update.mockReturnValue(mockChainObj);

  // Expose to global scope
  (globalThis as any).mockChain = mockChainObj;
  (globalThis as any).mockSelect = select;
  (globalThis as any).mockEq = eq;
  (globalThis as any).mockMaybeSingle = maybeSingle;
  (globalThis as any).mockSingle = single;
  (globalThis as any).mockInsert = insert;
  (globalThis as any).mockUpdate = update;
  (globalThis as any).mockThen = then;
  (globalThis as any).mockRpc = rpc;

  return {
    supabase: {
      from: vi.fn((table) => {
        mockChainObj._currentTable = table;
        return mockChainObj;
      }),
      rpc: rpc
    }
  };
});

// Import code under test
import { paymentEventProcessor } from '../src/lib/payments/core/paymentEvent';
import { StripePaymentProvider } from '../src/lib/payments/stripe/handler';
import { MidtransPaymentProvider } from '../src/lib/payments/midtrans/handler';
import { supabase } from '../src/lib/supabase.server';

describe('Hardened Payment Infrastructure', () => {
  const userId = '00000000-0000-0000-0000-000000000005';
  const productId = '00000000-0000-0000-0000-000000000010';
  const transactionId = '00000000-0000-0000-0000-000000000015';

  let mockChain: any;
  let mockSelect: any;
  let mockEq: any;
  let mockMaybeSingle: any;
  let mockSingle: any;
  let mockInsert: any;
  let mockUpdate: any;
  let mockThen: any;
  let mockRpc: any;

  beforeEach(() => {
    vi.resetAllMocks();
    mockChain = (globalThis as any).mockChain;
    mockSelect = (globalThis as any).mockSelect;
    mockEq = (globalThis as any).mockEq;
    mockMaybeSingle = (globalThis as any).mockMaybeSingle;
    mockSingle = (globalThis as any).mockSingle;
    mockInsert = (globalThis as any).mockInsert;
    mockUpdate = (globalThis as any).mockUpdate;
    mockThen = (globalThis as any).mockThen;
    mockRpc = (globalThis as any).mockRpc;

    vi.mocked(supabase.from).mockImplementation((table) => {
      mockChain._currentTable = table;
      return mockChain;
    });

    mockSelect.mockReturnValue(mockChain);
    mockEq.mockReturnValue(mockChain);
    mockInsert.mockReturnValue(mockChain);
    mockUpdate.mockReturnValue(mockChain);

    // Set safe default mock resolvers
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockSingle.mockResolvedValue({ data: {}, error: null });
    mockThen.mockImplementation((resolve: any) => {
      if (resolve && typeof resolve === 'function') {
        resolve({ data: [], error: null });
      }
    });
    
    process.env.STRIPE_WEBHOOK_SECRET = 'stripe_secret';
    process.env.MIDTRANS_SERVER_KEY = 'midtrans_secret';
  });

  describe('Webhook Security', () => {
    it('should reject invalid Stripe webhook signature', async () => {
      const provider = new StripePaymentProvider();
      const rawBody = JSON.stringify({ id: 'evt_123' });
      const timestamp = Math.floor(Date.now() / 1000);
      const headers = { 'stripe-signature': `t=${timestamp},v1=badsignature` };
      
      const isValid = await provider.verifyWebhook(rawBody, headers);
      expect(isValid).toBe(false);
    });

    it('should accept valid Stripe webhook signature', async () => {
      const provider = new StripePaymentProvider();
      const rawBody = JSON.stringify({ id: 'evt_123' });
      const timestamp = Math.floor(Date.now() / 1000);
      const secret = 'stripe_secret';
      
      const signedPayload = `${timestamp}.${rawBody}`;
      const signature = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex');
      const headers = { 'stripe-signature': `t=${timestamp},v1=${signature}` };

      const isValid = await provider.verifyWebhook(rawBody, headers);
      expect(isValid).toBe(true);
    });

    it('should reject invalid Midtrans webhook signature/hash', async () => {
      const provider = new MidtransPaymentProvider();
      const rawBody = JSON.stringify({
        order_id: 'order_123',
        status_code: '200',
        gross_amount: '3.00',
        signature_key: 'badsignature'
      });
      
      const isValid = await provider.verifyWebhook(rawBody, {});
      expect(isValid).toBe(false);
    });

    it('should accept valid Midtrans webhook signature/hash', async () => {
      const provider = new MidtransPaymentProvider();
      const orderId = 'order_123';
      const statusCode = '200';
      const grossAmount = '3.00';
      const serverKey = 'midtrans_secret';

      const payload = `${orderId}${statusCode}${grossAmount}${serverKey}`;
      const signature = crypto.createHash('sha512').update(payload).digest('hex');

      const rawBody = JSON.stringify({
        order_id: orderId,
        status_code: statusCode,
        gross_amount: grossAmount,
        signature_key: signature
      });

      const isValid = await provider.verifyWebhook(rawBody, {});
      expect(isValid).toBe(true);
    });
  });

  describe('Unified Payment Event Processing', () => {
    it('should process successful Stripe payment and grant entitlements', async () => {
      mockMaybeSingle.mockImplementation(async () => {
        const table = mockChain._currentTable;
        if (table === 'webhook_events') {
          return { data: null, error: null };
        }
        if (table === 'transactions') {
          return {
            data: { id: transactionId, user_id: userId, product_id: productId, status: 'PENDING' },
            error: null
          };
        }
        if (table === 'products') {
          return {
            data: { id: productId, slug: 'lifetime_pro', type: 'LIFETIME' },
            error: null
          };
        }
        if (table === 'founder_campaigns') {
          return {
            data: { id: 'camp_123', name: 'Founder Campaign', claimed_slots: 10, max_slots: 500, active: true },
            error: null
          };
        }
        if (table === 'user_entitlements') {
          return { data: null, error: null };
        }
        return { data: null, error: null };
      });

      mockSingle.mockResolvedValue({ data: { id: 'some_id' }, error: null });

      const event = {
        provider: 'stripe' as const,
        event: 'payment.success' as const,
        transaction_id: transactionId,
        provider_transaction_id: 'stripe_sess_123',
        product_id: productId,
        user_id: userId,
        amount: 79.0,
        currency: 'USD',
        payload: {},
        event_id: 'evt_stripe_123'
      };

      const result = await paymentEventProcessor(event);
      expect(result.success).toBe(true);
      
      // Check that grant was recorded
      expect(supabase.from).toHaveBeenCalledWith('user_entitlements');
      expect(supabase.from).toHaveBeenCalledWith('entitlement_audit_log');
    });

    it('should skip duplicate webhooks (idempotency check)', async () => {
      mockMaybeSingle.mockImplementation(async () => {
        const table = mockChain._currentTable;
        if (table === 'webhook_events') {
          return {
            data: { id: 'log_123', status: 'PROCESSED' },
            error: null
          };
        }
        return { data: null, error: null };
      });

      const event = {
        provider: 'stripe' as const,
        event: 'payment.success' as const,
        transaction_id: transactionId,
        provider_transaction_id: 'stripe_sess_123',
        product_id: productId,
        user_id: userId,
        amount: 79.0,
        currency: 'USD',
        payload: {},
        event_id: 'evt_stripe_123'
      };

      const result = await paymentEventProcessor(event);
      expect(result.success).toBe(true);
      expect(result.duplicated).toBe(true);
    });

    it('should fail if wrong product_id / unknown product is supplied', async () => {
      mockMaybeSingle.mockImplementation(async () => {
        const table = mockChain._currentTable;
        if (table === 'transactions') {
          return {
            data: { id: transactionId, user_id: userId, product_id: productId, status: 'PENDING' },
            error: null
          };
        }
        // Return null for products table
        if (table === 'products') {
          return { data: null, error: null };
        }
        return { data: null, error: null };
      });

      const event = {
        provider: 'stripe' as const,
        event: 'payment.success' as const,
        transaction_id: transactionId,
        provider_transaction_id: 'stripe_sess_123',
        product_id: productId,
        user_id: userId,
        amount: 79.0,
        currency: 'USD',
        payload: {},
        event_id: 'evt_stripe_123'
      };

      await expect(paymentEventProcessor(event)).rejects.toThrow('Product not found for ID: ' + productId);
    });

    it('should fail if founder slots are full', async () => {
      mockMaybeSingle.mockImplementation(async () => {
        const table = mockChain._currentTable;
        if (table === 'transactions') {
          return {
            data: { id: transactionId, user_id: userId, product_id: productId, status: 'PENDING' },
            error: null
          };
        }
        if (table === 'products') {
          return {
            data: { id: productId, slug: 'lifetime_pro', type: 'LIFETIME' },
            error: null
          };
        }
        if (table === 'founder_campaigns') {
          return {
            data: { id: 'camp_123', name: 'Founder Campaign', claimed_slots: 500, max_slots: 500, active: true },
            error: null
          };
        }
        return { data: null, error: null };
      });

      const event = {
        provider: 'stripe' as const,
        event: 'payment.success' as const,
        transaction_id: transactionId,
        provider_transaction_id: 'stripe_sess_123',
        product_id: productId,
        user_id: userId,
        amount: 79.0,
        currency: 'USD',
        payload: {},
        event_id: 'evt_stripe_123'
      };

      await expect(paymentEventProcessor(event)).rejects.toThrow('Founder campaign slots are full');
    });
  });

  describe('Entitlement Validity Checks', () => {
    it('should correctly calculate active entitlement when not expired', async () => {
      const { checkActiveEntitlement } = await import('../src/lib/payments/entitlement/check');
      
      mockThen.mockImplementationOnce((resolve: any) => {
        if (resolve && typeof resolve === 'function') {
          resolve({
            data: [{ id: 'ent_1', status: 'ACTIVE', expires_at: null, access_type: 'LIFETIME_PRO' }],
            error: null
          });
        }
        return { catch: vi.fn() };
      });

      const isActive = await checkActiveEntitlement(userId, 'LIFETIME_PRO');
      expect(isActive).toBe(true);
    });

    it('should correctly reject expired entitlements', async () => {
      const { checkActiveEntitlement } = await import('../src/lib/payments/entitlement/check');
      const pastDate = new Date(Date.now() - 5000).toISOString();

      mockThen.mockImplementationOnce((resolve: any) => {
        if (resolve && typeof resolve === 'function') {
          resolve({
            data: [{ id: 'ent_1', status: 'ACTIVE', expires_at: pastDate, access_type: 'TOURNAMENT_PASS' }],
            error: null
          });
        }
        return { catch: vi.fn() };
      });

      const isActive = await checkActiveEntitlement(userId, 'TOURNAMENT_PASS');
      expect(isActive).toBe(false);
    });
  });
});
