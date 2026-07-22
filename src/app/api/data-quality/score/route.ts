import { NextRequest, NextResponse } from 'next/server';
import { DataQualityEngine } from '../../../../lib/data-quality/data-quality-score';
import { IntegrityValidatorEngine } from '../../../../lib/data-quality/integrity-validator';

export async function GET(req: NextRequest) {
  try {
    const failures = IntegrityValidatorEngine.validateFixtureIntegrity({
      fixtureId: 'f-dq-101',
      homeScore: 2,
      awayScore: 1,
      kickoffIso: new Date().toISOString(),
      homeOdds: 2.05,
      awayOdds: 1.85,
      bookmakerMargin: 0.028,
    });

    const report = DataQualityEngine.evaluateQuality({
      fixtureId: 'f-dq-101',
      totalExpectedFields: 50,
      totalPopulatedFields: 49,
      bookmakerQuotesCount: 8,
      expectedBookmakersCount: 8,
      missingXgCount: 1,
      totalXgMatchesCount: 100,
      duplicateCount: 0,
      integrityFailures: failures,
    });

    return NextResponse.json({
      success: true,
      data: report,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
