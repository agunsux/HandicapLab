// Controlled egress job executor
// Location: src/lib/crons/egressJobs.ts
//
// Executes an `apifootball_job` inside the controlled worker. It reuses the
// EXISTING cron handlers so no ingestion/prediction/AH/odds logic is duplicated
// or altered. Those handlers call the canonical apiFootballClient ->
// ProviderGateway -> Provider Manager -> Quota -> Rate limit -> Cache/dedup ->
// API-Football, exactly as in serverless mode.
//
// The worker marks its request with EGRESS_WORKER_HEADER so the handlers do NOT
// re-enqueue (which would create a loop).

import { EGRESS_WORKER_HEADER } from './egressMode';
import type { EgressJobName, EgressEventRecord } from './egressQueue';

type RouteHandler = (request: Request) => Promise<Response>;
type RouteModule = { GET: RouteHandler };

// Route handlers may type their parameter as NextRequest; the worker only
// supplies a standard Request, so the module shape is narrowed here.
const asRouteModule = (mod: unknown): RouteModule => mod as RouteModule;

const ROUTE_LOADERS: Record<EgressJobName, () => Promise<RouteModule>> = {
  discovery: async () => asRouteModule(await import('@/app/api/cron/discovery/route')),
  enrichment: async () => asRouteModule(await import('@/app/api/cron/enrichment/route')),
  t60_snapshot: async () => asRouteModule(await import('@/app/api/cron/t60-snapshot/route')),
  ah_shadow: async () => asRouteModule(await import('@/app/api/cron/ah-shadow-pipeline/route')),
  generate_signals: async () => asRouteModule(await import('@/app/api/cron/generate-signals/route')),
  settle: async () => asRouteModule(await import('@/app/api/cron/settle/route')),
};

export function isKnownEgressJob(value: unknown): value is EgressJobName {
  return typeof value === 'string' && value in ROUTE_LOADERS;
}

/**
 * Execute one claimed egress event. Throws on failure so the worker can apply
 * bounded backoff and dead-letter behaviour.
 */
export async function executeEgressJob(record: EgressEventRecord): Promise<void> {
  const payload = (record.payload ?? {}) as { job?: unknown };
  const job = payload.job;

  if (!isKnownEgressJob(job)) {
    throw new Error(`Unknown egress job type: ${String(job)}`);
  }

  const routeModule = await ROUTE_LOADERS[job]();
  const request = new Request(`http://egress-worker.internal/api/cron/${job}`, {
    method: 'GET',
    headers: {
      authorization: `Bearer ${process.env.CRON_SECRET ?? ''}`,
      [EGRESS_WORKER_HEADER]: '1',
    },
  });

  const response = await routeModule.GET(request);
  if (!response || !response.ok) {
    const detail = response ? await response.text().catch(() => '') : 'no response';
    throw new Error(
      `Egress job ${job} failed: HTTP ${response?.status ?? 'n/a'} ${detail.slice(0, 300)}`
    );
  }
}
