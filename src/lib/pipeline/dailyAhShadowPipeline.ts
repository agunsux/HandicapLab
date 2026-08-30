// EPIC 57.1 â€” Daily Automated Asian Handicap Shadow Pipeline (Real API Integration)
// Location: src/lib/pipeline/dailyAhShadowPipeline.ts
// Scope: Asian Handicap ONLY, shadow mode, unattended execution, honest status banner

import * as fs from 'fs';
import * as path from 'path';
import {
  AhSide,
  SampleSizeStatus,
  ValueQualificationState,
  CanonicalMatch,
} from '../research/ah-solo/ahTypes';
import { AhSharedStateEngine } from '../research/ah-solo/ahSharedState';
import { AhProbabilityModels } from '../research/ah-solo/ahProbabilityModels';
import { AhValueEngine, computeActualSampleSize } from '../research/ah-solo/ahValueEngine';
import { settleAsianHandicap } from '../research/ah-solo/ahSettlementEngine';
import { apiFootballClient } from '../apis/apifootball';
import { oddsApiClient } from '../apis/oddspapi';

export interface OddsPapiV4Fixture {
  fixtureId: string;
  participant1Name: string;
  participant2Name: string;
  startTime: string;
  hasOdds?: boolean;
}

export const RESEARCH_HONESTY_BANNER =
  'RESEARCH STATUS: NOT YET VALIDATED. Historical backtest on 2015-2026 data shows no statistically significant edge (CLV Z=0.523, p=0.601; realized ROI -2.30% to -2.40% across tested configurations). This prediction is logged for track-record building, not as a recommendation.';

export const CONFIRMED_LEAGUES: Record<number, { name: string; country: string; sportKey?: string }> = {
  39: { name: 'Premier League', country: 'England', sportKey: 'soccer_epl' },
  140: { name: 'La Liga', country: 'Spain', sportKey: 'soccer_spain_la_liga' },
  135: { name: 'Serie A', country: 'Italy', sportKey: 'soccer_italy_serie_a' },
  78: { name: 'Bundesliga', country: 'Germany', sportKey: 'soccer_germany_bundesliga' },
  61: { name: 'Ligue 1', country: 'France', sportKey: 'soccer_france_ligue_one' },
  88: { name: 'Eredivisie', country: 'Netherlands', sportKey: 'soccer_netherlands_eredivisie' },
  94: { name: 'Primeira Liga', country: 'Portugal', sportKey: 'soccer_portugal_primeira_liga' },
  40: { name: 'Championship', country: 'England', sportKey: 'soccer_efl_champ' },
};

export interface DailyFixtureCandidate {
  fixtureId: string;
  leagueId: string;
  leagueName: string;
  country: string;
  homeTeam: string;
  awayTeam: string;
  kickoffTime: string;
  status: 'NS' | 'FT' | 'LIVE' | 'PST' | 'CANC';
  homeGoals?: number;
  awayGoals?: number;
  openingOdds?: Array<{
    line: number;
    homeOdds: number;
    awayOdds: number;
    bookmaker?: string;
    timestamp?: string;
  }>;
  closingOdds?: Array<{
    line: number;
    homeOdds: number;
    awayOdds: number;
    bookmaker?: string;
    timestamp?: string;
  }>;
}

export interface AhPredictionLedgerRecord {
  predictionId: string;
  id?: string;
  fixtureId: string;
  leagueId: string;
  leagueName: string;
  matchDate: string;
  kickoffTime: string;
  kickoffAt?: string;
  homeTeam: string;
  awayTeam: string;
  market: 'ASIAN_HANDICAP';
  line: number;
  side: AhSide;
  modelProb: number;
  fairProbability?: number;
  marketProb: number;
  devigMarketProbability?: number;
  fairOdds: number;
  marketOdds: number;
  takenOdds?: number;
  edge: number;
  ev: number;
  kellyFraction: number;
  recommendedStakePct: number;
  valueQualificationState: ValueQualificationState;
  sampleSize: number;
  sampleStatus: SampleSizeStatus;
  modelVersion: string;
  validationState: 'RESEARCH_ONLY';
  featureVersion?: string;
  settlementStatus: 'PENDING' | 'SETTLED' | 'VOID';
  actualHomeScore?: number;
  actualAwayScore?: number;
  settlementOutcome?: 'WIN' | 'HALF_WIN' | 'PUSH' | 'HALF_LOSS' | 'LOSS';
  actualOutcome?: string;
  closingLine?: number;
  closingOdds?: number;
  closingClv?: number;
  clv?: number;
  profit?: number;
  profitLoss?: number;
  settledAt?: string;
  researchHonestyBanner: string;
  researchStatusLabel?: string;
  generatedAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PipelineExecutionSummary {
  lastRunTimestamp: string;
  mode: 'SHADOW_UNATTENDED';
  monetizationEnabled: false;
  fixturesIngested: number;
  predictionsGenerated: number;
  predictionsSettled: number;
  settledCountTotal: number;
  targetSettledGate: number;
  gateProgressPct: number;
  meanLiveClv: number;
  liveClvZScore: number;
  activeModelVersion: string;
  failuresCount: number;
  failureRatePct: number;
  alertTriggered: boolean;
  failures: Array<{ fixtureId: string; stage: string; error: string }>;
}

function normalizeTeamName(name: string): string {
  return (name || '')
    .toLowerCase()
    .replace(/\b(fc|cf|cd|afc|ac|sc|ss|bv|sv|vfb|rb|athletic|club)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

export class DailyAhShadowPipeline {
  private static ledgerPath = path.join(process.cwd(), 'data', 'ledger', 'ah_predictions_ledger.jsonl');

  public static ensureLedgerDir(): void {
    const dir = path.dirname(this.ledgerPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  public static loadLedger(): AhPredictionLedgerRecord[] {
    if (!fs.existsSync(this.ledgerPath)) {
      return [];
    }
    const lines = fs.readFileSync(this.ledgerPath, 'utf-8').trim().split('\n').filter(Boolean);
    return lines.map((l) => {
      const r = JSON.parse(l);
      r.id = r.id || r.predictionId;
      r.kickoffAt = r.kickoffAt || r.kickoffTime;
      r.fairProbability = r.fairProbability !== undefined ? r.fairProbability : r.modelProb;
      r.devigMarketProbability = r.devigMarketProbability !== undefined ? r.devigMarketProbability : r.marketProb;
      r.takenOdds = r.takenOdds !== undefined ? r.takenOdds : r.marketOdds;
      r.clv = r.clv !== undefined ? r.clv : r.closingClv;
      r.actualOutcome = r.actualOutcome || r.settlementOutcome;
      r.profitLoss = r.profitLoss !== undefined ? r.profitLoss : r.profit;
      r.createdAt = r.createdAt || r.generatedAt;
      r.updatedAt = r.updatedAt || r.generatedAt;
      r.researchStatusLabel = r.researchStatusLabel || r.researchHonestyBanner;
      r.featureVersion = r.featureVersion || 'pit-football-v1';
      return r;
    });
  }

  public static appendLedger(records: AhPredictionLedgerRecord[]): void {
    this.ensureLedgerDir();
    const lines = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
    fs.appendFileSync(this.ledgerPath, lines, 'utf-8');
  }

  public static saveLedger(records: AhPredictionLedgerRecord[]): void {
    this.ensureLedgerDir();
    const lines = records.map((r) => JSON.stringify(r)).join('\n') + '\n';
    fs.writeFileSync(this.ledgerPath, lines, 'utf-8');
  }

  public static async fetchLiveUpcomingFixtures(): Promise<DailyFixtureCandidate[]> {
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 10);
    const candidates: DailyFixtureCandidate[] = [];

    const hasApiKey = !!(process.env.APIFOOTBALL_KEY || process.env.API_FOOTBALL_KEY);
    if (!hasApiKey) {
      console.warn('[DailyAhShadowPipeline] No APIFOOTBALL_KEY available.');
      return [];
    }

    // 1. Fetch live odds fixtures from OddsPapi V4
    let oddsFixtures: OddsPapiV4Fixture[] = [];
    try {
      oddsFixtures = await (oddsApiClient as any).getFixtures?.(today, tomorrow, 10) || [];
    } catch (err: any) {
      console.warn('[DailyAhShadowPipeline] OddsPapi fixtures fetch notice:', err.message);
    }

    // 2. Fetch API-Football fixtures
    for (const [leagueIdStr, meta] of Object.entries(CONFIRMED_LEAGUES)) {
      const leagueId = Number(leagueIdStr);

      for (const date of [today, tomorrow]) {
        try {
          const res = await apiFootballClient.getFixturesByDate(date);
          const items = Array.isArray(res) ? res : res?.response || [];

          for (const item of items) {
            if (!item?.fixture || item.fixture.status.short !== 'NS' || item.league?.id !== leagueId) continue;

            const fixtureId = `LIVE-${meta.name.replace(/\s+/g, '-').toUpperCase()}-${item.fixture.id}`;
            const homeName = item.teams.home.name;
            const awayName = item.teams.away.name;
            const kickoffTime = item.fixture.date;
            const fixTimeMs = new Date(kickoffTime).getTime();

            const openingOdds: Array<{ line: number; homeOdds: number; awayOdds: number; bookmaker?: string; timestamp?: string }> = [];

            // Match with OddsPapi V4 fixture
            const hNorm = normalizeTeamName(homeName);
            const aNorm = normalizeTeamName(awayName);

            const matchedOddsFixture = oddsFixtures.find((of) => {
              const ofHNorm = normalizeTeamName(of.participant1Name);
              const ofANorm = normalizeTeamName(of.participant2Name);
              const ofTimeMs = new Date(of.startTime).getTime();
              const diffHours = Math.abs(fixTimeMs - ofTimeMs) / (3600 * 1000);

              const isHome = ofHNorm.includes(hNorm) || hNorm.includes(ofHNorm);
              const isAway = ofANorm.includes(aNorm) || aNorm.includes(ofANorm);
              return isHome && isAway && diffHours <= 3.0;
            });

            // If matched and has odds, fetch real odds from OddsPapi V4
            if (matchedOddsFixture && matchedOddsFixture.hasOdds) {
              try {
                const oddsResp: any = await (oddsApiClient as any).getOddsByFixtureId?.(matchedOddsFixture.fixtureId);
                if (oddsResp && oddsResp.bookmakerOdds) {
                  const bks = Object.entries(oddsResp.bookmakerOdds);
                  for (const [bkName, bkData] of bks) {
                    const bk = bkData as any;
                    if (!bk.markets) continue;
                    for (const [mId, mData] of Object.entries(bk.markets)) {
                      const m = mData as any;
                      if (m.outcomes && typeof m.outcomes === 'object') {
                        const outcomesArr = Array.isArray(m.outcomes) ? m.outcomes : Object.values(m.outcomes);
                        if (outcomesArr.length >= 2) {
                          const o1 = outcomesArr[0] as any;
                          const o2 = outcomesArr[1] as any;
                          if (typeof o1.point === 'number' && typeof o1.price === 'number' && typeof o2.price === 'number') {
                            openingOdds.push({
                              line: o1.point,
                              homeOdds: o1.price,
                              awayOdds: o2.price,
                              bookmaker: bkName,
                              timestamp: new Date().toISOString(),
                            });
                          }
                        }
                      }
                    }
                  }
                }
              } catch (err: any) {
                console.warn(`[DailyAhShadowPipeline] Odds fetch error for ${fixtureId}:`, err.message);
              }
            }

            candidates.push({
              fixtureId,
              leagueId: String(leagueId),
              leagueName: meta.name,
              country: meta.country,
              homeTeam: homeName,
              awayTeam: awayName,
              kickoffTime,
              status: 'NS',
              openingOdds: openingOdds.length > 0 ? openingOdds : undefined,
            });
          }
        } catch (err: any) {
          console.warn(`[DailyAhShadowPipeline] Live fetch error for ${meta.name} (${date}):`, err.message);
        }
      }
    }

    return candidates;
  }

  public static async fetchLiveFinishedFixtures(): Promise<DailyFixtureCandidate[]> {
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);
    const finished: DailyFixtureCandidate[] = [];

    const hasApiKey = !!(process.env.APIFOOTBALL_KEY || process.env.API_FOOTBALL_KEY);
    if (!hasApiKey) return [];

    try {
      const res = await apiFootballClient.getFixturesByDate(yesterday);
      const items = Array.isArray(res) ? res : res?.response || [];

      for (const item of items) {
        const leagueId = item.league?.id;
        if (!CONFIRMED_LEAGUES[leagueId]) continue;
        if (!item?.fixture || item.fixture.status.short !== 'FT') continue;

        const meta = CONFIRMED_LEAGUES[leagueId];
        const fixtureId = `LIVE-${meta.name.replace(/\s+/g, '-').toUpperCase()}-${item.fixture.id}`;

        finished.push({
          fixtureId,
          leagueId: String(leagueId),
          leagueName: meta.name,
          country: meta.country,
          homeTeam: item.teams.home.name,
          awayTeam: item.teams.away.name,
          kickoffTime: item.fixture.date,
          status: 'FT',
          homeGoals: item.goals.home ?? undefined,
          awayGoals: item.goals.away ?? undefined,
        });
      }
    } catch (err: any) {
      console.warn(`[DailyAhShadowPipeline] Settlement fetch error:`, err.message);
    }

    return finished;
  }

  public static async executeDailyPredictions(
    upcomingFixtures: DailyFixtureCandidate[],
    historicalMatches: CanonicalMatch[],
    nowIso = new Date().toISOString()
  ): Promise<{
    generatedRecords: AhPredictionLedgerRecord[];
    failures: Array<{ fixtureId: string; stage: string; error: string }>;
  }> {
    const existingLedger = this.loadLedger();
    const existingKeys = new Set(
      existingLedger.map((r) => `${r.fixtureId}|${r.line.toFixed(2)}|${r.side}`)
    );

    const generatedRecords: AhPredictionLedgerRecord[] = [];
    const failures: Array<{ fixtureId: string; stage: string; error: string }> = [];

    const fittedRho = -0.05; // Locked champion parameter from EPIC 56

    for (const fixture of upcomingFixtures) {
      try {
        if (!fixture.openingOdds || fixture.openingOdds.length === 0) {
          continue;
        }

        const pseudoMatch: CanonicalMatch = {
          canonicalId: fixture.fixtureId,
          leagueId: fixture.leagueId,
          cluster: 'A',
          season: '2025-2026',
          matchDate: fixture.kickoffTime.slice(0, 10),
          homeTeam: fixture.homeTeam,
          awayTeam: fixture.awayTeam,
          homeGoals: 0,
          awayGoals: 0,
          result: 'H',
          resultVerified: false,
          totalGoals: 0,
        };

        const state = AhSharedStateEngine.computeState(pseudoMatch, historicalMatches);
        const dcMatrix = AhProbabilityModels.computeDixonColesMatrix(
          state.expectedHomeGoals,
          state.expectedAwayGoals,
          fittedRho
        );
        const gdPmf = AhProbabilityModels.matrixToGoalDifferencePmf(dcMatrix);

        for (const odds of fixture.openingOdds) {
          const devig = AhValueEngine.devig2WayAh(odds.homeOdds, odds.awayOdds);

          // 1. Home prediction
          const homeKey = `${fixture.fixtureId}|${odds.line.toFixed(2)}|home`;
          if (!existingKeys.has(homeKey)) {
            const homeProbs = AhProbabilityModels.deriveAhSettlementProbabilities(gdPmf, odds.line, 'home');
            const homeEv = AhValueEngine.computeSettlementAwareEv(homeProbs, odds.homeOdds);
            const homeEdge = Number((homeProbs.pCover - devig.homeFairProb).toFixed(4));
            const homeTrainingCount = computeActualSampleSize(
              odds.line,
              fixture.leagueId,
              historicalMatches.map((m) => ({ line: odds.line, leagueId: m.leagueId }))
            );
            const homeSampleStatus = AhValueEngine.getSampleSizeStatus(
              odds.line,
              homeTrainingCount > 0 ? homeTrainingCount : historicalMatches.length
            );

            const predId = `PRED-${fixture.fixtureId}-${odds.line.toFixed(2)}-HOME`;
            generatedRecords.push({
              predictionId: predId,
              id: predId,
              fixtureId: fixture.fixtureId,
              leagueId: fixture.leagueId,
              leagueName: fixture.leagueName,
              matchDate: fixture.kickoffTime.slice(0, 10),
              kickoffTime: fixture.kickoffTime,
              kickoffAt: fixture.kickoffTime,
              homeTeam: fixture.homeTeam,
              awayTeam: fixture.awayTeam,
              market: 'ASIAN_HANDICAP',
              line: odds.line,
              side: 'home',
              modelProb: Number(homeProbs.pCover.toFixed(4)),
              fairProbability: Number(homeProbs.pCover.toFixed(4)),
              marketProb: Number(devig.homeFairProb.toFixed(4)),
              devigMarketProbability: Number(devig.homeFairProb.toFixed(4)),
              fairOdds: Number((1 / homeProbs.pCover).toFixed(2)),
              marketOdds: odds.homeOdds,
              takenOdds: odds.homeOdds,
              edge: homeEdge,
              ev: homeEv,
              kellyFraction: 0,
              recommendedStakePct: 0,
              valueQualificationState: 'NOT_VALIDATED',
              sampleSize: homeTrainingCount,
              sampleStatus: homeSampleStatus,
              modelVersion: 'AH-dixoncoles-v1.0.0',
              validationState: 'RESEARCH_ONLY',
              featureVersion: 'pit-football-v1',
              settlementStatus: 'PENDING',
              researchHonestyBanner: RESEARCH_HONESTY_BANNER,
              researchStatusLabel: RESEARCH_HONESTY_BANNER,
              generatedAt: nowIso,
              createdAt: nowIso,
              updatedAt: nowIso,
            });
          }

          // 2. Away prediction
          const awayKey = `${fixture.fixtureId}|${odds.line.toFixed(2)}|away`;
          if (!existingKeys.has(awayKey)) {
            const awayProbs = AhProbabilityModels.deriveAhSettlementProbabilities(gdPmf, odds.line, 'away');
            const awayEv = AhValueEngine.computeSettlementAwareEv(awayProbs, odds.awayOdds);
            const awayEdge = Number((awayProbs.pCover - devig.awayFairProb).toFixed(4));
            const awayTrainingCount = computeActualSampleSize(
              odds.line,
              fixture.leagueId,
              historicalMatches.map((m) => ({ line: odds.line, leagueId: m.leagueId }))
            );
            const awaySampleStatus = AhValueEngine.getSampleSizeStatus(
              odds.line,
              awayTrainingCount > 0 ? awayTrainingCount : historicalMatches.length
            );

            const predId = `PRED-${fixture.fixtureId}-${odds.line.toFixed(2)}-AWAY`;
            generatedRecords.push({
              predictionId: predId,
              id: predId,
              fixtureId: fixture.fixtureId,
              leagueId: fixture.leagueId,
              leagueName: fixture.leagueName,
              matchDate: fixture.kickoffTime.slice(0, 10),
              kickoffTime: fixture.kickoffTime,
              kickoffAt: fixture.kickoffTime,
              homeTeam: fixture.homeTeam,
              awayTeam: fixture.awayTeam,
              market: 'ASIAN_HANDICAP',
              line: odds.line,
              side: 'away',
              modelProb: Number(awayProbs.pCover.toFixed(4)),
              fairProbability: Number(awayProbs.pCover.toFixed(4)),
              marketProb: Number(devig.awayFairProb.toFixed(4)),
              devigMarketProbability: Number(devig.awayFairProb.toFixed(4)),
              fairOdds: Number((1 / awayProbs.pCover).toFixed(2)),
              marketOdds: odds.awayOdds,
              takenOdds: odds.awayOdds,
              edge: awayEdge,
              ev: awayEv,
              kellyFraction: 0,
              recommendedStakePct: 0,
              valueQualificationState: 'NOT_VALIDATED',
              sampleSize: awayTrainingCount,
              sampleStatus: awaySampleStatus,
              modelVersion: 'AH-dixoncoles-v1.0.0',
              validationState: 'RESEARCH_ONLY',
              featureVersion: 'pit-football-v1',
              settlementStatus: 'PENDING',
              researchHonestyBanner: RESEARCH_HONESTY_BANNER,
              researchStatusLabel: RESEARCH_HONESTY_BANNER,
              generatedAt: nowIso,
              createdAt: nowIso,
              updatedAt: nowIso,
            });
          }
        }
      } catch (err: any) {
        failures.push({
          fixtureId: fixture.fixtureId,
          stage: 'PREDICTION_GENERATION',
          error: err.message,
        });
      }
    }

    if (generatedRecords.length > 0) {
      this.appendLedger(generatedRecords);
    }

    return { generatedRecords, failures };
  }

  public static async executeAutomatedSettlement(
    finishedFixtures: DailyFixtureCandidate[]
  ): Promise<{
    settledCount: number;
    failures: Array<{ fixtureId: string; stage: string; error: string }>;
  }> {
    let settledCount = 0;
    const failures: Array<{ fixtureId: string; stage: string; error: string }> = [];

    const ledger = this.loadLedger();
    const finishedMap = new Map<string, DailyFixtureCandidate>();
    for (const f of finishedFixtures) {
      if (f.status === 'FT' || f.homeGoals !== undefined) {
        finishedMap.set(f.fixtureId, f);
      }
    }

    let modified = false;
    for (let i = 0; i < ledger.length; i++) {
      const record = ledger[i];
      if (record.settlementStatus === 'PENDING') {
        const finished = finishedMap.get(record.fixtureId);
        if (finished && finished.homeGoals !== undefined && finished.awayGoals !== undefined) {
          try {
            const hGoals = Number(finished.homeGoals);
            const aGoals = Number(finished.awayGoals);

            // Find closing odds for this specific line if available
            let closingPrice: number | undefined;
            if (finished.closingOdds && finished.closingOdds.length > 0) {
              const matchedClosing = finished.closingOdds.find(
                (co) => Math.abs(co.line - record.line) < 0.01
              );
              if (matchedClosing) {
                closingPrice = record.side === 'home' ? matchedClosing.homeOdds : matchedClosing.awayOdds;
              }
            }

            const settlement = settleAsianHandicap(
              record.side,
              record.line,
              hGoals,
              aGoals,
              record.takenOdds || record.marketOdds || 1.95,
              1.0
            );

            record.settlementStatus = 'SETTLED';
            record.actualOutcome = settlement.outcome;
            record.profitLoss = Number(settlement.profit.toFixed(2));
            record.settledAt = new Date().toISOString();
            record.updatedAt = new Date().toISOString();

            if (closingPrice && closingPrice > 1.0) {
              record.closingOdds = closingPrice;
              record.clv = AhValueEngine.computeClv(record.takenOdds || record.marketOdds, closingPrice);
            }

            settledCount++;
            modified = true;
          } catch (err: any) {
            failures.push({
              fixtureId: record.fixtureId,
              stage: 'SETTLEMENT',
              error: err.message,
            });
          }
        }
      }
    }

    if (modified) {
      this.saveLedger(ledger);
    }

    return { settledCount, failures };
  }

  public static generatePipelineSummary(currentRunGeneratedCount: number = 0): PipelineExecutionSummary {
    const ledger = this.loadLedger();
    const settled = ledger.filter((r) => r.settlementStatus === 'SETTLED');
    const targetSettledGate = 175;
    const gateProgressPct = Number(Math.min(100, (settled.length / targetSettledGate) * 100).toFixed(1));

    return {
      lastRunTimestamp: new Date().toISOString(),
      mode: 'SHADOW_UNATTENDED',
      monetizationEnabled: false,
      fixturesIngested: 0,
      predictionsGenerated: currentRunGeneratedCount,
      predictionsSettled: 0,
      settledCountTotal: settled.length,
      targetSettledGate,
      gateProgressPct,
      meanLiveClv: 0,
      liveClvZScore: 0,
      activeModelVersion: 'AH-dixoncoles-v1.0.0',
      failuresCount: 0,
      failureRatePct: 0,
      alertTriggered: false,
      failures: [],
    };
  }
}
