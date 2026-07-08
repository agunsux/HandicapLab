// Admin Diagnostics API — Read-only research and system status
// Location: src/app/api/admin/diagnostics/route.ts

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

interface SystemHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  memory: { used: number; total: number; percent: number };
  nodeVersion: string;
  timestamp: string;
}

interface ResearchStatus {
  benchmarkStatus: 'NOT_RUN' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  validationStatus: 'NOT_RUN' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  calibrationStatus: 'NOT_RUN' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  driftStatus: 'NOT_RUN' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  datasetStatus: 'NOT_LOADED' | 'LOADING' | 'LOADED' | 'STALE';
  lastValidationRun: string | null;
  lastBenchmarkRun: string | null;
  modelVersion: string;
}

interface DiagnosticsResponse {
  system: SystemHealth;
  research: ResearchStatus;
  timestamp: string;
}

const startTime = Date.now();

export async function GET() {
  const now = Date.now();
  const uptimeSeconds = Math.floor((now - startTime) / 1000);
  const memoryUsage = process.memoryUsage();
  const heapUsed = Math.round(memoryUsage.heapUsed / 1024 / 1024);
  const heapTotal = Math.round(memoryUsage.heapTotal / 1024 / 1024);

  const system: SystemHealth = {
    status: heapUsed / heapTotal > 0.9 ? 'unhealthy' : heapUsed / heapTotal > 0.7 ? 'degraded' : 'healthy',
    uptime: uptimeSeconds,
    memory: { used: heapUsed, total: heapTotal, percent: Math.round((heapUsed / heapTotal) * 100) },
    nodeVersion: process.version,
    timestamp: new Date().toISOString(),
  };

  const research: ResearchStatus = {
    benchmarkStatus: 'NOT_RUN',
    validationStatus: 'NOT_RUN',
    calibrationStatus: 'NOT_RUN',
    driftStatus: 'NOT_RUN',
    datasetStatus: 'NOT_LOADED',
    lastValidationRun: null,
    lastBenchmarkRun: null,
    modelVersion: 'v0.5-ai',
  };

  const response: DiagnosticsResponse = { system, research, timestamp: new Date().toISOString() };
  return NextResponse.json(response, { status: 200 });
}
