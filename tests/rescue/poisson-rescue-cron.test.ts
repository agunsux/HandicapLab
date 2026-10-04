import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { NextRequest } from 'next/server';
import { GET } from '@/app/api/cron/rescue-pipeline/route';
import { PoissonRescueService } from '@/lib/pipeline/rescue/poissonRescueService';

describe('Rescue Pipeline Cron Schedule & Auth Governance', () => {
  const originalEnv = process.env.CRON_SECRET;

  beforeEach(() => {
    process.env.CRON_SECRET = 'test-rescue-cron-secret-123';
  });

  afterEach(() => {
    process.env.CRON_SECRET = originalEnv;
    vi.restoreAllMocks();
  });

  it('enforces exact approved cron schedule 0 7 * * * in vercel.json', () => {
    const vercelConfigPath = path.resolve('vercel.json');
    expect(fs.existsSync(vercelConfigPath)).toBe(true);

    const config = JSON.parse(fs.readFileSync(vercelConfigPath, 'utf8'));
    const rescueCron = config.crons?.find(
      (c: any) => c.path === '/api/cron/rescue-pipeline'
    );

    expect(rescueCron).toBeDefined();
    expect(rescueCron.schedule).toBe('0 7 * * *');
  });

  it('rejects unauthorized cron requests without bearer token', async () => {
    const req = new NextRequest('http://localhost:3000/api/cron/rescue-pipeline');
    const res = await GET(req);
    expect(res.status).toBe(401);

    const data = await res.json();
    expect(data.error).toBe('Unauthorized');
  });

  it('allows authorized cron invocation with valid Bearer secret', async () => {
    const executeSpy = vi.spyOn(PoissonRescueService, 'execute').mockResolvedValue({
      telemetry: {
        run_id: 'TEST-RUN-CRON',
        model_version: 'poisson_v1_rescue',
        status: 'SUCCESS',
        fixture_count: 0,
        prediction_count: 0,
        odds_count: 0,
        settled_count: 0,
        picks_generated: 0,
        error_count: 0,
        duration_ms: 10,
        quota_remaining: 142,
        data_sources: { fixtures: 'api-football', odds: 'oddspapi' },
        data_quality_flags: [],
        executed_at: new Date().toISOString(),
      },
      predictions: [],
    });

    const req = new NextRequest('http://localhost:3000/api/cron/rescue-pipeline', {
      headers: {
        authorization: 'Bearer test-rescue-cron-secret-123',
      },
    });

    const res = await GET(req);
    expect(res.status).toBe(200);

    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.telemetry.run_id).toBe('TEST-RUN-CRON');
    expect(executeSpy).toHaveBeenCalledOnce();
  });
});
