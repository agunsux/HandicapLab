import { NextRequest, NextResponse } from 'next/server';
import { getLiveValidationStore } from '../../../../live-validation/store';
import { ScientificEvidenceArchiver } from '../../../../live-validation/archive/evidence-archiver';

export async function GET(req: NextRequest) {
  try {
    const store = getLiveValidationStore();
    const archiver = new ScientificEvidenceArchiver(store);
    const archives = archiver.listArchives();

    return NextResponse.json({
      success: true,
      count: archives.length,
      archives,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
