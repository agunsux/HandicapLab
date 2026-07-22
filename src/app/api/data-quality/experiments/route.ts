import { NextRequest, NextResponse } from 'next/server';
import { ExperimentRegistryEngine } from '../../../../lib/data-quality/experiment-registry';

export async function GET(req: NextRequest) {
  try {
    const experiments = ExperimentRegistryEngine.getExperiments();
    return NextResponse.json({
      success: true,
      data: experiments,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
