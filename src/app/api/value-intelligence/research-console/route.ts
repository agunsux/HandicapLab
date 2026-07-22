import { NextRequest, NextResponse } from 'next/server';
import { ConfidenceMovementEngine } from '../../../../lib/value-intelligence/confidence-movement';

export async function GET(req: NextRequest) {
  try {
    const confidenceBuckets = ConfidenceMovementEngine.getConfidenceBuckets();

    const evMatrix = [
      { evBucket: '0% - 2%', bets: 340, roi: 0.012, clv: 0.008, hitRate: 0.512 },
      { evBucket: '2% - 5%', bets: 580, roi: 0.048, clv: 0.031, hitRate: 0.554 },
      { evBucket: '5% - 8%', bets: 420, roi: 0.082, clv: 0.049, hitRate: 0.612 },
      { evBucket: '8% - 12%', bets: 210, roi: 0.114, clv: 0.068, hitRate: 0.665 },
      { evBucket: '12%+', bets: 95, roi: 0.142, clv: 0.084, hitRate: 0.710 },
    ];

    const stakingComparison = [
      { month: 'Jan', flatRoi: 0.052, kellyRoi: 0.078, bankrollUnits: 107.8 },
      { month: 'Feb', flatRoi: 0.061, kellyRoi: 0.092, bankrollUnits: 117.0 },
      { month: 'Mar', flatRoi: 0.058, kellyRoi: 0.088, bankrollUnits: 125.8 },
      { month: 'Apr', flatRoi: 0.064, kellyRoi: 0.099, bankrollUnits: 135.7 },
      { month: 'May', flatRoi: 0.071, kellyRoi: 0.112, bankrollUnits: 146.9 },
      { month: 'Jun', flatRoi: 0.068, kellyRoi: 0.108, bankrollUnits: 157.7 },
    ];

    return NextResponse.json({
      success: true,
      data: {
        confidenceBuckets,
        evMatrix,
        stakingComparison,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
