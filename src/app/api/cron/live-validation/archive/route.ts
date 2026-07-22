import { NextRequest, NextResponse } from 'next/server';
import { getLiveValidationStore } from '../../../../../live-validation/store';
import { ScientificEvidenceArchiver } from '../../../../../live-validation/archive/evidence-archiver';
import { JobRunner } from '../../../../../live-validation/ops/job-runner';

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
  }

  const correlationId = `cron-archive-${Date.now()}`;
  const runRecord = await JobRunner.startRun('archive', correlationId);

  try {
    const store = getLiveValidationStore();
    const archiver = new ScientificEvidenceArchiver(store);
    const result = await archiver.exportDailyArchive();

    await JobRunner.finishRun(runRecord, {
      status: 'succeeded',
      itemsProcessed: result.manifest.predictionsCount,
    });

    return NextResponse.json({
      success: true,
      archivePath: result.archivePath,
      manifest: result.manifest,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await JobRunner.finishRun(runRecord, {
      status: 'failed',
      errorMessage: message,
    });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
