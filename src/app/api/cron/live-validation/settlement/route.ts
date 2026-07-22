import { NextRequest, NextResponse } from 'next/server';
import { SettlementEngine } from '../../../../../live-validation/settlement/settlement-engine';
import { getLiveValidationStore } from '../../../../../live-validation/store';
import { DEFAULT_LIVE_VALIDATION_CONFIG } from '../../../../../live-validation/config';

class SystemResultSource {
  async getResult(fixtureId: string) {
    const { supabase } = await import('../../../../../lib/supabase.server');
    const { data } = await supabase
      .from('matches')
      .select('home_score, away_score, status')
      .eq('id', fixtureId)
      .eq('status', 'finished')
      .maybeSingle();

    if (!data || data.home_score === null || data.away_score === null) {
      return null;
    }

    return {
      homeScore: Number(data.home_score),
      awayScore: Number(data.away_score),
    };
  }
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
  }

  try {
    const store = getLiveValidationStore();
    const engine = new SettlementEngine({
      store,
      results: new SystemResultSource(),
      config: DEFAULT_LIVE_VALIDATION_CONFIG,
    });

    const report = await engine.run();
    return NextResponse.json({ success: true, report });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
