// API-Football egress mode
// Location: src/lib/crons/egressMode.ts
//
// Controls WHERE API-Football provider work executes:
//   'serverless' (default) — existing behaviour: Vercel cron/route calls the
//                            canonical ProviderGateway directly.
//   'worker'               — cron/route handlers only ENQUEUE work; the single
//                            controlled egress worker performs provider calls.
//
// Worker mode is opt-in and never enabled implicitly. The default is
// 'serverless' so a missing/typo'd value cannot silently migrate production.

export type EgressMode = 'serverless' | 'worker';

/** Header set by the controlled worker so routes execute instead of re-enqueuing. */
export const EGRESS_WORKER_HEADER = 'x-hl-egress-worker';

export function getEgressMode(): EgressMode {
  const raw = (process.env.APIFOOTBALL_EGRESS_MODE || 'serverless').trim().toLowerCase();
  return raw === 'worker' ? 'worker' : 'serverless';
}

export function isWorkerEgress(): boolean {
  return getEgressMode() === 'worker';
}

/** True when the request originates from the controlled egress worker. */
export function isEgressWorkerRequest(request: Request): boolean {
  return request.headers.get(EGRESS_WORKER_HEADER) === '1';
}

/**
 * True when a Vercel request must only enqueue, because provider calls are
 * owned by the worker. The worker's own request carries EGRESS_WORKER_HEADER and
 * therefore executes normally (prevents enqueue recursion).
 */
export function shouldDeferProviderWork(request: Request): boolean {
  return isWorkerEgress() && !isEgressWorkerRequest(request);
}
