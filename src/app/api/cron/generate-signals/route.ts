import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase.server';
import { apiFootballClient } from '@/lib/apis/apifootball';
import { oddsApiClient } from '@/lib/apis/oddspapi';
import { FeatureEngine } from '@/lib/engines/feature-engine';
import { ProbabilityEngine } from '@/lib/engines/probability-engine';
import { getLeagueConfig, getLeagueConfigById } from '@/lib/crons/leagueRegistry';
import { CalibrationEngine } from '@/lib/engine/calibration';
import { calculateKelly } from '@/lib/engine/kelly';
import { sendTelegramAlert } from '@/lib/services/telegram';
import { CronLogger } from '@/lib/services/cronLogger';
import { runHealthCheck } from '@/lib/services/healthChecker';
import { createSignalEvent } from '@/lib/alerts/events';
import { ModelIntelligenceAdjuster } from '@/lib/intelligence/adjuster';
import { PerformanceAttribution } from '@/lib/intelligence/attribution';
import { toFiniteNumber, isMalformed } from '@/lib/utils/number';
import { OddsIngestionContext } from '@/lib/observability/oddsIngestion';

const SPORT_MAP: Record<number, string> = {
  39: 'soccer_epl',
  2: 'soccer_uefa_champs_league',
  3: 'soccer_uefa_europa_league',
  140: 'soccer_spain_la_liga',
  135: 'soccer_italy_serie_a',
  78: 'soccer_germany_bundesliga',
  61: 'soccer_france_ligue1',
  1: 'soccer_fifa_world_cup',
  844: 'soccer_uefa_europa_conference_league',
  848: 'soccer_france_ligue2'
};

function getSportKey(apiFootballId: number): string {
  return SPORT_MAP[apiFootballId] || 'soccer_epl';
}

async function saveOrUpdateSignal(
  signalPayload: any,
  leagueConfig: any,
  matchUuid: string,
  marketType: string,
  odds: number,
  probability: number,
  maxStakePct: number,
  settledSignalCount: number,
  unitSize: number
) {
  // Fetch league quality score from cache
  const { data: dbLeague } = await supabase
    .from('leagues_cache')
    .select('quality_score')
    .eq('name', leagueConfig.name)
    .maybeSingle();
  const qualityScore = dbLeague?.quality_score ?? 75;

  // Check if signal exists
  const { data: existing } = await supabase
    .from('signals')
    .select('*')
    .eq('match_id', signalPayload.match_id)
    .eq('market', signalPayload.market)
    .eq('handicap_line', signalPayload.handicap_line || 0.0)
    .maybeSingle();

  let steamScore = 0;
  let lineMove = 0;

  if (existing) {
    const currentLine = Number(signalPayload.handicap_line || 0.0);
    const openingLine = Number(existing.opening_line !== null ? existing.opening_line : existing.handicap_line || 0.0);
    const currentOdds = Number(signalPayload.odds || 1.00);
    const openingOdds = Number(existing.opening_odds !== null ? existing.opening_odds : existing.odds || 1.00);

    const steamResult = ModelIntelligenceAdjuster.calculateSteamScore(
      signalPayload.market,
      signalPayload.selection,
      openingLine,
      currentLine,
      openingOdds,
      currentOdds
    );
    steamScore = steamResult.steamScore;
    lineMove = steamResult.lineMove;
  }

  // Adjust confidence
  const adjustedConfidence = ModelIntelligenceAdjuster.adjustConfidence(
    Number(signalPayload.confidence || 50),
    qualityScore,
    steamScore
  );

  // Calibrate probability
  const confidenceBucket = PerformanceAttribution.getConfidenceBucket(adjustedConfidence);
  const { data: attributionStats } = await supabase
    .from('signal_performance_attribution')
    .select('roi, clv, is_win, is_loss')
    .eq('confidence_bucket', confidenceBucket);

  let historicalWinRate = 0.5;
  if (attributionStats && attributionStats.length > 0) {
    const wins = attributionStats.filter((a: any) => a.is_win).length;
    historicalWinRate = wins / attributionStats.length;
  }

  const calibratedProb = attributionStats && attributionStats.length > 0
    ? Number(((probability + historicalWinRate) / 2).toFixed(4))
    : probability;

  // Add calibration fields to payload
  signalPayload.confidence = adjustedConfidence;
  signalPayload.confidence_score = adjustedConfidence;
  signalPayload.predicted_probability = probability;
  signalPayload.calibrated_probability = calibratedProb;

  if (existing) {
    const updates: any = {
      confidence: adjustedConfidence,
      confidence_score: adjustedConfidence,
      predicted_probability: probability,
      calibrated_probability: calibratedProb
    };
    let changesOccurred = false;

    if (Number(existing.odds) !== Number(signalPayload.odds)) {
      updates.odds = signalPayload.odds;
      changesOccurred = true;
      await createSignalEvent(existing.id, 'ODDS_MOVEMENT', {
        from: Number(existing.odds),
        to: Number(signalPayload.odds)
      });
    }

    if (Number(existing.edge_pct) !== Number(signalPayload.edge_pct)) {
      updates.edge_pct = signalPayload.edge_pct;
      changesOccurred = true;
      await createSignalEvent(existing.id, 'EDGE_CHANGED', {
        from: Number(existing.edge_pct),
        to: Number(signalPayload.edge_pct)
      });
    }

    if (Number(existing.confidence) !== Number(adjustedConfidence)) {
      changesOccurred = true;
      await createSignalEvent(existing.id, 'CONFIDENCE_CHANGED', {
        from: Number(existing.confidence),
        to: adjustedConfidence
      });
    }

    if (changesOccurred) {
      updates.updated_at = new Date().toISOString();
      await supabase
        .from('signals')
        .update(updates)
        .eq('id', existing.id);
    }
    return { ...existing, ...updates };
  } else {
    const { data: insertedSignal } = await supabase
      .from('signals')
      .insert(signalPayload)
      .select()
      .single();

    if (insertedSignal) {
      await createSignalEvent(insertedSignal.id, 'NEW_SIGNAL', {
        selection: insertedSignal.selection,
        odds: insertedSignal.odds
      });

      const kellyRes = calculateKelly(odds, probability, maxStakePct, settledSignalCount);
      const kellyVal = kellyRes.stakeFraction;
      await supabase.from('paper_trades').insert({
        signal_id: insertedSignal.id,
        match_id: matchUuid,
        competition_id: leagueConfig.id,
        market_type: marketType,
        odds: odds,
        stake: unitSize,
        kelly_fraction: kellyVal,
        kelly_metadata: {
          stake_pct: kellyRes.stakeFraction,
          kelly_mode: kellyRes.mode,
          sample_size: kellyRes.sampleSize
        },
        status: 'pending'
      });
    }
    return insertedSignal;
  }
}

function isTeamMatch(name1: string, name2: string): boolean {
  const n1 = name1.toLowerCase().replace(/[\s-_]/g, '');
  const n2 = name2.toLowerCase().replace(/[\s-_]/g, '');
  return n1.includes(n2) || n2.includes(n1);
}

function formatAhLine(line: number): string {
  if (line === 0) return '0.0';
  return line > 0 ? `+${line.toFixed(1)}` : `${line.toFixed(1)}`;
}

export async function GET(request: Request) {
  return handleGenerateSignals(request);
}

export async function POST(request: Request) {
  return handleGenerateSignals(request);
}

async function handleGenerateSignals(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const logId = await CronLogger.start('generate-signals');
  const ctx = new OddsIngestionContext('generate-signals');
  let recordsProcessed = 0;

  const isDryRun = process.env.CRON_DRY_RUN === 'true';
  const now = new Date();
  const maxKickoff = new Date(now.getTime() + 48 * 60 * 60 * 1000);

  console.log(`[GenerateSignals Cron] Starting pipeline. Dry Run: ${isDryRun}`);

  try {
    // Fetch paper trading configurations
    const { data: config } = await supabase
      .from('paper_trading_config')
      .select('starting_bankroll, unit_size, max_stake_percentage')
      .limit(1)
      .maybeSingle();

    const unitSize = config?.unit_size ? Number(config.unit_size) : 10.0;
    const maxStakePct = config?.max_stake_percentage ? Number(config.max_stake_percentage) : 5.0;

    // Fetch dynamic thresholds from the calibration engine
    const thresholds = await CalibrationEngine.getDynamicThresholds();
    console.log(`[GenerateSignals Cron] Active edge thresholds: AH=${thresholds.AH}%, OU=${thresholds.OU}%, ML=${thresholds.ML}% (Brier: ${thresholds.brierScore})`);

    // Fetch settled signals count for Kelly gate calculations
    const { count: settledCountRes } = await supabase
      .from('signals')
      .select('*', { count: 'exact', head: true })
      .not('settled_at', 'is', null);
    const settledSignalCount = settledCountRes || 0;

    const { LEAGUE_REGISTRY } = await import('@/lib/crons/leagueRegistry');
    const activeLeagues = LEAGUE_REGISTRY.filter(l => l.enabled && (l.status === 'ACTIVE' || l.status === 'BETA'));
    
    interface GlobalFixtureItem {
      leagueConfig: any;
      fixture: any;
    }
    const globalFixturesList: GlobalFixtureItem[] = [];
    const nowStr = now.toISOString().split('T')[0];

    for (const leagueConfig of activeLeagues) {
      if (leagueConfig.activation) {
        const { start, end } = leagueConfig.activation;
        if (nowStr < start || (end && nowStr > end)) {
          console.log(`[GenerateSignals] Skipping league ${leagueConfig.name}: not in activation window (${start} to ${end})`);
          continue;
        }
      }

      try {
        const fixturesResponse = await apiFootballClient.getFixtures(leagueConfig.apiFootballId, 2026);
        const upcoming = fixturesResponse.response.filter((f: any) => {
          const kTime = new Date(f.fixture.date);
          return kTime > now && kTime <= maxKickoff && f.fixture.status.short === 'NS';
        });

        for (const fixture of upcoming) {
          globalFixturesList.push({ leagueConfig, fixture });
        }
      } catch (err) {
        console.error(`[GenerateSignals] Failed to fetch fixtures for ${leagueConfig.name}:`, err);
      }
    }

    // Sort globally by priority ASC (Priority 1 first) then kickoff_time ASC
    globalFixturesList.sort((a, b) => {
      if (a.leagueConfig.priority !== b.leagueConfig.priority) {
        return a.leagueConfig.priority - b.leagueConfig.priority;
      }
      const dateA = new Date(a.fixture.fixture.date).getTime();
      const dateB = new Date(b.fixture.fixture.date).getTime();
      return dateA - dateB;
    });

    let generatedSignalsCount = 0;
    const dryRunSignals: any[] = [];
    const oddsCache = new Map<string, any[]>();

    for (const { leagueConfig, fixture: f } of globalFixturesList) {
      const homeTeam = f.teams.home.name;
      const awayTeam = f.teams.away.name;
      const kickoffTime = new Date(f.fixture.date);

      const sportKey = getSportKey(leagueConfig.apiFootballId);
      let oddsList = oddsCache.get(sportKey);
      if (!oddsList) {
        try {
          oddsList = await oddsApiClient.getOdds(sportKey);
          oddsCache.set(sportKey, oddsList);
        } catch (err) {
          console.error(`[GenerateSignals] Failed to fetch odds for ${sportKey}:`, err);
          continue;
        }
      }

        // Find match in Odds API
        const matchOdds = oddsList.find(o => isTeamMatch(o.home_team, homeTeam) && isTeamMatch(o.away_team, awayTeam));
        if (!matchOdds) continue;

        const pinnacle = matchOdds.bookmakers.find((b: any) => b.key === 'pinnacle');
        if (!pinnacle) continue;

        // Fetch Dynamic Team Ratings
        const { data: homeRating } = await supabase
          .from('team_ratings')
          .select('attack_strength, defense_strength')
          .eq('team_id', homeTeam)
          .maybeSingle();

        const { data: awayRating } = await supabase
          .from('team_ratings')
          .select('attack_strength, defense_strength')
          .eq('team_id', awayTeam)
          .maybeSingle();

        const dynamicHomeAttack = homeRating?.attack_strength ? Number(homeRating.attack_strength) : 1.0;
        const dynamicHomeDefense = homeRating?.defense_strength ? Number(homeRating.defense_strength) : 1.0;
        const dynamicAwayAttack = awayRating?.attack_strength ? Number(awayRating.attack_strength) : 1.0;
        const dynamicAwayDefense = awayRating?.defense_strength ? Number(awayRating.defense_strength) : 1.0;

        // Upsert match into database matches table so FeatureEngine can query it
        let matchUuid = '';
        const isIntMatch = leagueConfig.cohort === 'WORLD_CUP';
        const { data: existingMatch } = await supabase
          .from('matches')
          .select('id')
          .eq('home_team', homeTeam)
          .eq('away_team', awayTeam)
          .eq('kickoff', kickoffTime.toISOString())
          .maybeSingle();

        if (existingMatch) {
          matchUuid = existingMatch.id;
        } else {
          const { data: newMatch, error: insertErr } = await supabase
            .from('matches')
            .insert({
              home_team: homeTeam,
              away_team: awayTeam,
              league: leagueConfig.name,
              kickoff: kickoffTime.toISOString(),
              status: 'upcoming',
              competition_type: isIntMatch ? 'international' : 'club'
            })
            .select()
            .single();

          if (insertErr || !newMatch) {
            console.error('[GenerateSignals] Failed to insert match:', insertErr);
            continue;
          }
          matchUuid = newMatch.id;
        }

        // Run Quant engine on the match for each market Priority
        for (const marketType of ['ML', 'AH', 'OU'] as const) {
          try {
            const features = await FeatureEngine.build(matchUuid, kickoffTime, marketType);
            
            // Override features with dynamic ratings strengths (fallback to 1.0 handled above)
            features.homeAttack = dynamicHomeAttack;
            features.homeDefense = dynamicHomeDefense;
            features.awayAttack = dynamicAwayAttack;
            features.awayDefense = dynamicAwayDefense;

            let oddsSnapshot: any = undefined;
            if (pinnacle) {
              if (marketType === 'ML') {
                const h2hMarket = pinnacle.markets.find((m: any) => m.key === 'h2h');
                if (h2hMarket) {
                  const homeOutcome = h2hMarket.outcomes.find((o: any) => isTeamMatch(o.name, homeTeam));
                  const drawOutcome = h2hMarket.outcomes.find((o: any) => o.name.toLowerCase() === 'draw');
                  const awayOutcome = h2hMarket.outcomes.find((o: any) => isTeamMatch(o.name, awayTeam));
                  oddsSnapshot = {
                    bookmaker: 'pinnacle',
                    homeOdds: homeOutcome?.price,
                    drawOdds: drawOutcome?.price,
                    awayOdds: awayOutcome?.price
                  };
                }
              } else if (marketType === 'AH') {
                const spreadsMarket = pinnacle.markets.find((m: any) => m.key === 'spreads');
                if (spreadsMarket) {
                  const homeOutcome = spreadsMarket.outcomes.find((o: any) => isTeamMatch(o.name, homeTeam));
                  const awayOutcome = spreadsMarket.outcomes.find((o: any) => isTeamMatch(o.name, awayTeam));
                  oddsSnapshot = {
                    bookmaker: 'pinnacle',
                    homeOdds: homeOutcome?.price,
                    awayOdds: awayOutcome?.price,
                    line: homeOutcome?.point
                  };
                }
              } else if (marketType === 'OU') {
                const totalsMarket = pinnacle.markets.find((m: any) => m.key === 'totals');
                if (totalsMarket) {
                  const overOutcome = totalsMarket.outcomes.find((o: any) => o.name.toLowerCase() === 'over');
                  const underOutcome = totalsMarket.outcomes.find((o: any) => o.name.toLowerCase() === 'under');
                  oddsSnapshot = {
                    bookmaker: 'pinnacle',
                    homeOdds: overOutcome?.price,
                    awayOdds: underOutcome?.price,
                    line: overOutcome?.point
                  };
                }
              }
            }

            const probOutput = await ProbabilityEngine.predict(features, { oddsSnapshot });
            const confidenceScore = probOutput.confidence ? Math.round(probOutput.confidence.finalConfidence * 100) : 50;

            if (confidenceScore < 65) continue;

            if (marketType === 'ML') {
              const h2hMarket = pinnacle.markets.find((m: any) => m.key === 'h2h');
              if (!h2hMarket) continue;

              const homeOutcome = h2hMarket.outcomes.find((o: any) => isTeamMatch(o.name, homeTeam));
              const drawOutcome = h2hMarket.outcomes.find((o: any) => o.name.toLowerCase() === 'draw');
              const awayOutcome = h2hMarket.outcomes.find((o: any) => isTeamMatch(o.name, awayTeam));

               const evaluateML = async (selection: string, probability: number, odds: number) => {
                const safeOdds = toFiniteNumber(odds);
                const safeProbability = toFiniteNumber(probability);
                if (
                  safeOdds === null ||
                  safeProbability === null ||
                  safeOdds <= 0 ||
                  safeProbability <= 0
                ) {
                  if (isMalformed(odds) || isMalformed(probability)) {
                    console.warn("Skipping invalid market data", {
                      fixtureId: matchUuid,
                      homeTeam,
                      awayTeam,
                      market: 'ML',
                      rawOdds: odds,
                      rawProbability: probability
                    });
                  }
                  return;
                }
                if (safeOdds < 1.70 || safeOdds > 2.30) return;
                const fairOdds = 1.0 / safeProbability;
                const edge = ((safeOdds * safeProbability) - 1.0) * 100;

                const impliedProb = 1.0 / safeOdds;
                const divergence = Math.abs(safeProbability - impliedProb);
                const isAnomaly = divergence > 0.15;
                const anomalyReason = isAnomaly
                  ? `Model probability (${(safeProbability * 100).toFixed(1)}%) vs market implied probability (${(impliedProb * 100).toFixed(1)}%) exceeds 15% divergence threshold.`
                  : null;

                if (edge >= thresholds.ML) {
                  const signalPayload = {
                    match_id: matchUuid,
                    league: leagueConfig.name,
                    home_team: homeTeam,
                    away_team: awayTeam,
                    kickoff_utc: kickoffTime.toISOString(),
                    market: 'moneyline',
                    selection,
                    odds: safeOdds,
                    fair_odds: Number(fairOdds.toFixed(4)),
                    probability: Number(safeProbability.toFixed(4)),
                    edge_pct: Number(edge.toFixed(2)),
                    confidence: confidenceScore,
                    status: 'pending',
                    model_version: 'dc_poisson_ensemble_v1',
                    rating_version: 'v1',
                    calibration_version: 'platt_v1',
                    confidence_score: confidenceScore,
                    is_anomaly: isAnomaly,
                    anomaly_reason: anomalyReason,
                    competition_type: leagueConfig.competition_type,
                    feature_snapshot: {
                      model: 'dixon_coles_poisson_ensemble',
                      attack_home: dynamicHomeAttack,
                      defense_home: dynamicHomeDefense,
                      attack_away: dynamicAwayAttack,
                      defense_away: dynamicAwayDefense,
                      market_edge: Number(edge.toFixed(2)),
                      threshold: thresholds.ML
                    },
                    opening_odds: odds,
                    opening_probability: Number(probability.toFixed(4)),
                    expires_at: kickoffTime.toISOString(),
                    signal_type: 'PRE_MATCH',
                    last_odds_update: new Date().toISOString(),
                    odds_age_minutes: 0
                  };

                  if (isDryRun) {
                    dryRunSignals.push(signalPayload);
                  } else {
                    const insertedSignal = await saveOrUpdateSignal(
                      signalPayload,
                      leagueConfig,
                      matchUuid,
                      marketType,
                      odds,
                      probability,
                      maxStakePct,
                      settledSignalCount,
                      unitSize
                    );
                    if (insertedSignal) {
                      generatedSignalsCount++;
                    }
                  }
                }
              };

              if (homeOutcome) await evaluateML('home', probOutput.pHome, homeOutcome.price);
              if (drawOutcome) await evaluateML('draw', probOutput.pDraw, drawOutcome.price);
              if (awayOutcome) await evaluateML('away', probOutput.pAway, awayOutcome.price);

            } else if (marketType === 'AH') {
              const spreadsMarket = pinnacle.markets.find((m: any) => m.key === 'spreads');
              if (!spreadsMarket) continue;

              // Usually spreads outcomes have: { name: homeTeam, price: 1.95, point: -0.5 }
              for (const outcome of spreadsMarket.outcomes) {
                const isHome = isTeamMatch(outcome.name, homeTeam);
                const lineVal = outcome.point;
                const lineKey = formatAhLine(isHome ? lineVal : -lineVal);
                const probability = isHome ? probOutput.pAhHome[lineKey] : probOutput.pAhAway[lineKey];

                const safeOdds = toFiniteNumber(outcome.price);
                const safeProbability = toFiniteNumber(probability);
                if (
                  safeOdds === null ||
                  safeProbability === null ||
                  safeOdds <= 0 ||
                  safeProbability <= 0
                ) {
                  if (isMalformed(outcome.price) || isMalformed(probability)) {
                    console.warn("Skipping invalid market data", {
                      fixtureId: matchUuid,
                      homeTeam,
                      awayTeam,
                      market: 'AH',
                      rawOdds: outcome.price,
                      rawProbability: probability
                    });
                  }
                  continue;
                }

                if (safeOdds < 1.70 || safeOdds > 2.30) continue;

                const fairOdds = 1.0 / safeProbability;
                const edge = ((safeOdds * safeProbability) - 1.0) * 100;

                const impliedProb = 1.0 / safeOdds;
                const divergence = Math.abs(safeProbability - impliedProb);
                const isAnomaly = divergence > 0.15;
                const anomalyReason = isAnomaly
                  ? `Model probability (${(safeProbability * 100).toFixed(1)}%) vs market implied probability (${(impliedProb * 100).toFixed(1)}%) exceeds 15% divergence threshold.`
                  : null;

                if (edge >= thresholds.AH) {
                  const signalPayload = {
                    match_id: matchUuid,
                    league: leagueConfig.name,
                    home_team: homeTeam,
                    away_team: awayTeam,
                    kickoff_utc: kickoffTime.toISOString(),
                    market: 'asian_handicap',
                    handicap_line: isHome ? lineVal : -lineVal,
                    selection: isHome ? 'home' : 'away',
                    odds: safeOdds,
                    fair_odds: Number(fairOdds.toFixed(4)),
                    probability: Number(safeProbability.toFixed(4)),
                    edge_pct: Number(edge.toFixed(2)),
                    confidence: confidenceScore,
                    status: 'pending',
                    model_version: 'dc_poisson_ensemble_v1',
                    rating_version: 'v1',
                    calibration_version: 'platt_v1',
                    confidence_score: confidenceScore,
                    is_anomaly: isAnomaly,
                    anomaly_reason: anomalyReason,
                    competition_type: leagueConfig.competition_type,
                    feature_snapshot: {
                      model: 'dixon_coles_poisson_ensemble',
                      attack_home: dynamicHomeAttack,
                      defense_home: dynamicHomeDefense,
                      attack_away: dynamicAwayAttack,
                      defense_away: dynamicAwayDefense,
                      market_edge: Number(edge.toFixed(2)),
                      threshold: thresholds.AH
                    },
                    opening_odds: outcome.price,
                    opening_probability: Number(probability.toFixed(4)),
                    expires_at: kickoffTime.toISOString(),
                    signal_type: 'PRE_MATCH',
                    last_odds_update: new Date().toISOString(),
                    odds_age_minutes: 0
                  };

                  if (isDryRun) {
                    dryRunSignals.push(signalPayload);
                  } else {
                    const insertedSignal = await saveOrUpdateSignal(
                      signalPayload,
                      leagueConfig,
                      matchUuid,
                      marketType,
                      outcome.price,
                      probability,
                      maxStakePct,
                      settledSignalCount,
                      unitSize
                    );
                    if (insertedSignal) {
                      generatedSignalsCount++;
        ctx.signalsGenerated++;
                    }
                  }
                }
              }

            } else if (marketType === 'OU') {
              const totalsMarket = pinnacle.markets.find((m: any) => m.key === 'totals');
              if (!totalsMarket) continue;

              for (const outcome of totalsMarket.outcomes) {
                const isOver = outcome.name.toLowerCase() === 'over';
                const lineVal = outcome.point;
                const lineKey = lineVal.toFixed(1);
                const probability = isOver ? probOutput.pOver[lineKey] : probOutput.pUnder[lineKey];

                const safeOdds = toFiniteNumber(outcome.price);
                const safeProbability = toFiniteNumber(probability);
                if (
                  safeOdds === null ||
                  safeProbability === null ||
                  safeOdds <= 0 ||
                  safeProbability <= 0
                ) {
                  if (isMalformed(outcome.price) || isMalformed(probability)) {
                    console.warn("Skipping invalid market data", {
                      fixtureId: matchUuid,
                      homeTeam,
                      awayTeam,
                      market: 'OU',
                      rawOdds: outcome.price,
                      rawProbability: probability
                    });
                  }
                  continue;
                }

                if (safeOdds < 1.70 || safeOdds > 2.30) continue;

                const fairOdds = 1.0 / safeProbability;
                const edge = ((safeOdds * safeProbability) - 1.0) * 100;

                const impliedProb = 1.0 / safeOdds;
                const divergence = Math.abs(safeProbability - impliedProb);
                const isAnomaly = divergence > 0.15;
                const anomalyReason = isAnomaly
                  ? `Model probability (${(safeProbability * 100).toFixed(1)}%) vs market implied probability (${(impliedProb * 100).toFixed(1)}%) exceeds 15% divergence threshold.`
                  : null;

                if (edge >= thresholds.OU) {
                  const signalPayload = {
                    match_id: matchUuid,
                    league: leagueConfig.name,
                    home_team: homeTeam,
                    away_team: awayTeam,
                    kickoff_utc: kickoffTime.toISOString(),
                    market: 'over_under',
                    handicap_line: lineVal,
                    selection: isOver ? 'over' : 'under',
                    odds: safeOdds,
                    fair_odds: Number(fairOdds.toFixed(4)),
                    probability: Number(safeProbability.toFixed(4)),
                    edge_pct: Number(edge.toFixed(2)),
                    confidence: confidenceScore,
                    status: 'pending',
                    model_version: 'dc_poisson_ensemble_v1',
                    rating_version: 'v1',
                    calibration_version: 'platt_v1',
                    confidence_score: confidenceScore,
                    is_anomaly: isAnomaly,
                    anomaly_reason: anomalyReason,
                    competition_type: leagueConfig.competition_type,
                    feature_snapshot: {
                      model: 'dixon_coles_poisson_ensemble',
                      attack_home: dynamicHomeAttack,
                      defense_home: dynamicHomeDefense,
                      attack_away: dynamicAwayAttack,
                      defense_away: dynamicAwayDefense,
                      market_edge: Number(edge.toFixed(2)),
                      threshold: thresholds.OU
                    },
                    opening_odds: outcome.price,
                    opening_probability: Number(probability.toFixed(4)),
                    expires_at: kickoffTime.toISOString(),
                    signal_type: 'PRE_MATCH',
                    last_odds_update: new Date().toISOString(),
                    odds_age_minutes: 0
                  };

                  if (isDryRun) {
                    dryRunSignals.push(signalPayload);
                  } else {
                    const insertedSignal = await saveOrUpdateSignal(
                      signalPayload,
                      leagueConfig,
                      matchUuid,
                      marketType,
                      outcome.price,
                      probability,
                      maxStakePct,
                      settledSignalCount,
                      unitSize
                    );
                    if (insertedSignal) {
                      generatedSignalsCount++;
        ctx.signalsGenerated++;
                    }
                  }
                }
              }
            }
          } catch (err) {
            console.error(`[GenerateSignals] Error generating ${marketType} predictions for match ${matchUuid}:`, err);
          }
        }
      }
    if (isDryRun) {
      console.log(`[GenerateSignals DRY RUN COMPLETED] Candidate count: ${dryRunSignals.length}`);
      await CronLogger.end(logId, dryRunSignals.length, null);
        await ctx.flush();
      try {
        await runHealthCheck();
      } catch (hcErr) {
        console.error('[GenerateSignals Cron] Health check audit failed:', hcErr);
      }
      return NextResponse.json({
        success: true,
        dryRun: true,
        candidateCount: dryRunSignals.length,
        candidates: dryRunSignals
      });
    }

    console.log(`[GenerateSignals PIPELINE COMPLETED] Signals generated: ${generatedSignalsCount}`);
    await CronLogger.end(logId, generatedSignalsCount, null);
        await ctx.flush();
    try {
      await runHealthCheck();
    } catch (hcErr) {
      console.error('[GenerateSignals Cron] Health check audit failed:', hcErr);
    }
    return NextResponse.json({
      success: true,
      dryRun: false,
      signalsGenerated: generatedSignalsCount
    });
  } catch (error: any) {
    console.error('[GenerateSignals Cron Fatal Error]:', error);
    await CronLogger.end(logId, 0, error);
        await ctx.flush();
    // Send Telegram alert notification on fatal failure
    await sendTelegramAlert(`GenerateSignals Cron Failed: ${error.message || error}`);
    try {
      await runHealthCheck();
    } catch (hcErr) {
      console.error('[GenerateSignals Cron] Health check audit failed:', hcErr);
    }
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
