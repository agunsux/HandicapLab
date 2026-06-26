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

            const probOutput = await ProbabilityEngine.predict(features);
            const confidenceScore = probOutput.confidence ? Math.round(probOutput.confidence.finalConfidence * 100) : 50;

            if (confidenceScore < 65) continue;

            if (marketType === 'ML') {
              const h2hMarket = pinnacle.markets.find((m: any) => m.key === 'h2h');
              if (!h2hMarket) continue;

              const homeOutcome = h2hMarket.outcomes.find((o: any) => isTeamMatch(o.name, homeTeam));
              const drawOutcome = h2hMarket.outcomes.find((o: any) => o.name.toLowerCase() === 'draw');
              const awayOutcome = h2hMarket.outcomes.find((o: any) => isTeamMatch(o.name, awayTeam));

              const evaluateML = async (selection: string, probability: number, odds: number) => {
                if (odds < 1.70 || odds > 2.30) return;
                const fairOdds = 1.0 / probability;
                const edge = ((odds * probability) - 1.0) * 100;

                const impliedProb = 1.0 / odds;
                const divergence = Math.abs(probability - impliedProb);
                const isAnomaly = divergence > 0.15;
                const anomalyReason = isAnomaly
                  ? `Model probability (${(probability * 100).toFixed(1)}%) vs market implied probability (${(impliedProb * 100).toFixed(1)}%) exceeds 15% divergence threshold.`
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
                    odds,
                    fair_odds: Number(fairOdds.toFixed(4)),
                    probability: Number(probability.toFixed(4)),
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
                    signal_type: 'PRE_MATCH'
                  };

                  if (isDryRun) {
                    dryRunSignals.push(signalPayload);
                  } else {
                    const { data: insertedSignal } = await supabase.from('signals').insert(signalPayload).select().single();
                    if (insertedSignal) {
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

                if (!probability || outcome.price < 1.70 || outcome.price > 2.30) continue;

                const fairOdds = 1.0 / probability;
                const edge = ((outcome.price * probability) - 1.0) * 100;

                const impliedProb = 1.0 / outcome.price;
                const divergence = Math.abs(probability - impliedProb);
                const isAnomaly = divergence > 0.15;
                const anomalyReason = isAnomaly
                  ? `Model probability (${(probability * 100).toFixed(1)}%) vs market implied probability (${(impliedProb * 100).toFixed(1)}%) exceeds 15% divergence threshold.`
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
                    odds: outcome.price,
                    fair_odds: Number(fairOdds.toFixed(4)),
                    probability: Number(probability.toFixed(4)),
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
                    signal_type: 'PRE_MATCH'
                  };

                  if (isDryRun) {
                    dryRunSignals.push(signalPayload);
                  } else {
                    const { data: insertedSignal } = await supabase.from('signals').insert(signalPayload).select().single();
                    if (insertedSignal) {
                      const kellyRes = calculateKelly(outcome.price, probability, maxStakePct, settledSignalCount);
                      const kellyVal = kellyRes.stakeFraction;
                      await supabase.from('paper_trades').insert({
                        signal_id: insertedSignal.id,
                        match_id: matchUuid,
                        competition_id: leagueConfig.id,
                        market_type: marketType,
                        odds: outcome.price,
                        stake: unitSize,
                        kelly_fraction: kellyVal,
                        kelly_metadata: {
                          stake_pct: kellyRes.stakeFraction,
                          kelly_mode: kellyRes.mode,
                          sample_size: kellyRes.sampleSize
                        },
                        status: 'pending'
                      });
                      generatedSignalsCount++;
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

                if (!probability || outcome.price < 1.70 || outcome.price > 2.30) continue;

                const fairOdds = 1.0 / probability;
                const edge = ((outcome.price * probability) - 1.0) * 100;

                const impliedProb = 1.0 / outcome.price;
                const divergence = Math.abs(probability - impliedProb);
                const isAnomaly = divergence > 0.15;
                const anomalyReason = isAnomaly
                  ? `Model probability (${(probability * 100).toFixed(1)}%) vs market implied probability (${(impliedProb * 100).toFixed(1)}%) exceeds 15% divergence threshold.`
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
                    odds: outcome.price,
                    fair_odds: Number(fairOdds.toFixed(4)),
                    probability: Number(probability.toFixed(4)),
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
                    signal_type: 'PRE_MATCH'
                  };

                  if (isDryRun) {
                    dryRunSignals.push(signalPayload);
                  } else {
                    const { data: insertedSignal } = await supabase.from('signals').insert(signalPayload).select().single();
                    if (insertedSignal) {
                      const kellyRes = calculateKelly(outcome.price, probability, maxStakePct, settledSignalCount);
                      const kellyVal = kellyRes.stakeFraction;
                      await supabase.from('paper_trades').insert({
                        signal_id: insertedSignal.id,
                        match_id: matchUuid,
                        competition_id: leagueConfig.id,
                        market_type: marketType,
                        odds: outcome.price,
                        stake: unitSize,
                        kelly_fraction: kellyVal,
                        kelly_metadata: {
                          stake_pct: kellyRes.stakeFraction,
                          kelly_mode: kellyRes.mode,
                          sample_size: kellyRes.sampleSize
                        },
                        status: 'pending'
                      });
                      generatedSignalsCount++;
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
