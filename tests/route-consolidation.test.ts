import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getCronPipeline, POST as postCronPipeline } from '@/app/api/cron/pipeline/route';
import { GET as getPerformance } from '@/app/api/performance/route';
import { GET as getLedger } from '@/app/api/ledger/[[...slug]]/route';
import { DurableLedgerStore } from '@/lib/ledger/durableLedgerStore';
import { ProductionPublishingEngine } from '@/lib/publishing/productionPublishingEngine';
import { HighConfidenceLedgerService } from '@/lib/ledger/highConfidenceLedgerService';

describe('Route Consolidation Verification (Gate 1 & Gate 2)', () => {
  beforeEach(() => {
    DurableLedgerStore.clearStoreForTesting();
    ProductionPublishingEngine.saveStore({});
  });

  describe('/api/cron/pipeline consolidation', () => {
    it('executes publishing reconciliation when mode=reconcile', async () => {
      const req = new NextRequest('http://localhost:3000/api/cron/pipeline?mode=reconcile');
      const res = await getCronPipeline(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('reconciliation complete');
      expect(data.report).toBeDefined();
    });

    it('executes publishing reconciliation via POST', async () => {
      const req = new NextRequest('http://localhost:3000/api/cron/pipeline?mode=reconcile', { method: 'POST' });
      const res = await postCronPipeline(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
    });

    it('executes bet settlement when mode=settle', async () => {
      const req = new NextRequest('http://localhost:3000/api/cron/pipeline?mode=settle');
      const res = await getCronPipeline(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.unsettledCount).toBeDefined();
      expect(data.settlementReport).toBeDefined();
      expect(data.todaySummary).toBeDefined();
    });
  });

  describe('/api/performance consolidation', () => {
    it('returns daily performance when view=daily', async () => {
      const req = new NextRequest('http://localhost:3000/api/performance?view=daily&date=2026-09-20');
      const res = await getPerformance(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.date).toBe('2026-09-20');
      expect(data.threshold).toBe(70);
      expect(data.summary).toBeDefined();
      expect(data.filtered).toBeDefined();
      expect(Array.isArray(data.bets)).toBe(true);
    });

    it('preserves overall report when view is not specified', async () => {
      const req = new NextRequest('http://localhost:3000/api/performance');
      const res = await getPerformance(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.generatedAtUtc).toBeDefined();
      expect(data.allTime).toBeDefined();
    });
  });

  describe('/api/ledger/[[...slug]] consolidation', () => {
    it('returns high-confidence ledger entries with threshold 70', async () => {
      const req = new NextRequest('http://localhost:3000/api/ledger/high-confidence?limit=10');
      const res = await getLedger(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.threshold).toBe(70);
      expect(data.totalCount).toBeDefined();
      expect(Array.isArray(data.entries)).toBe(true);
    });

    it('returns high-confidence ledger when accessed at /api/ledger directly', async () => {
      const req = new NextRequest('http://localhost:3000/api/ledger');
      const res = await getLedger(req);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.success).toBe(true);
      expect(data.threshold).toBe(70);
    });
  });
});
