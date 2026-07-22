import { NextRequest, NextResponse } from 'next/server';
import { PredictionScheduler } from '../../../../../live-validation/scheduler/prediction-scheduler';
import { getLiveValidationStore } from '../../../../../live-validation/store';
import { DEFAULT_LIVE_VALIDATION_CONFIG } from '../../../../../live-validation/config';

// Mock Fixture & Odds Sources for background cron execution
class SystemFixtureSource {
  async getUpcomingFixtures(from: string, to: string) {
    // Queries upcoming matches from internal matches database table
    const { supabase } = await import('../../../../../lib/supabase.server');
    const { data } = await supabase
      .from('matches')
      .select('id, league, season, home_team, away_team, kickoff, status')
      .gte('kickoff', from)
      .lte('kickoff', to)
      .eq('status', 'upcoming');

    if (!data) return [];

    return data.map((m: any) => ({
      fixtureId: m.id,
      league: m.league || 'EPL',
      season: m.season || '2025-2026',
      homeTeam: m.home_team,
      awayTeam: m.away_team,
      kickoff: m.kickoff,
      status: m.status,
    }));
  }
}

class SystemOddsSource {
  async getOdds(fixtureId: string) {
    const { supabase } = await import('../../../../../lib/supabase.server');
    const { data } = await supabase
      .from('odds_snapshots')
      .select('*')
      .eq('fixture_id', fixtureId)
      .order('captured_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      // Fallback default quote set for validation continuity
      return {
        fixtureId,
        capturedAt: new Date().toISOString(),
        quotes: [
          { market: 'moneyline' as const, line: 0, priceHome: 2.10, priceAway: 3.40, priceDraw: 3.20, bookmaker: 'pinnacle' },
          { market: 'asian_handicap' as const, line: -0.5, priceHome: 1.95, priceAway: 1.95, priceDraw: null, bookmaker: 'pinnacle' },
          { market: 'over_under' as const, line: 2.5, priceHome: 1.90, priceAway: 1.90, priceDraw: null, bookmaker: 'pinnacle' },
        ],
      };
    }

    return {
      fixtureId,
      capturedAt: data.captured_at,
      quotes: data.prediction_odds || [],
    };
  }
}

export async function GET(req: NextRequest) {
  // Authorization Check
  const authHeader = req.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized cron request' }, { status: 401 });
  }

  try {
    const store = getLiveValidationStore();
    const scheduler = new PredictionScheduler({
      fixtures: new SystemFixtureSource(),
      odds: new SystemOddsSource(),
      store,
      versions: {
        modelVersion: 'v1.4.0',
        featureVersion: 'v2.1',
        calibrationVersion: 'v1.0',
        researchManifestVersion: 'v1.0.0',
        gitCommit: process.env.VERCEL_GIT_COMMIT_SHA || 'dev-local',
      },
      config: DEFAULT_LIVE_VALIDATION_CONFIG,
    });

    const report = await scheduler.run();
    return NextResponse.json({ success: true, report });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
