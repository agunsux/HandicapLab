// HandicapLab API - Get Shadow Mode Orchestration Status
// Location: src/app/api/shadow-mode/status/route.ts

import { NextResponse } from 'next/server';
import { EventQueue } from '../../../../lib/paper-trading/eventSystem';
import { ModelRegistry } from '../../../../lib/engines/decision-engine-v1/registry';

export async function GET() {
  try {
    const jobs = EventQueue.getJobs();
    const pendingJobs = jobs.filter((j) => j.status === 'pending').length;
    const completedJobs = jobs.filter((j) => j.status === 'completed').length;
    const failedJobs = jobs.filter((j) => j.status === 'failed').length;

    return NextResponse.json({
      status: 'operational',
      heartbeat: new Date().toISOString(),
      orchestrator: {
        activeModelsCount: ModelRegistry.getModels().length,
        modelVersion: 'Model_v3.5',
        weightsVersion: '1.0.0',
        featureVersion: 'market_features_v1',
        calibrationVersion: 'Beta'
      },
      queue: {
        totalJobs: jobs.length,
        pending: pendingJobs,
        completed: completedJobs,
        failed: failedJobs
      }
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
