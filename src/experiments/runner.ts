// HandicapLab Reusable Experiment Runner
// Location: src/experiments/runner.ts

import * as fs from 'fs';
import * as path from 'path';
import { ProbabilityEngine } from '../lib/engines/probability-engine';
import { MatchFeatures } from '../lib/engines/feature-engine/types';
import { EdgeEngine, BookmakerOddsSnapshot } from '../lib/engines/edge-engine';
import { DecisionEngine } from '../lib/engines/decision-engine';
import { RecommendationEngine } from '../lib/engines/recommendation-engine';
import { ExperimentConfig } from './config';
import { SimulatedBet, MetricsEngine, ExperimentMetrics } from './metrics';

interface MatchRow {
  dateStr: string;
  timestamp: number;
  season: string;
  homeTeam: string;
  awayTeam: string;
  fthg: number;
  ftag: number;
  ftr: string;
  avgH: number;
  avgD: number;
  avgA: number;
  avgOver: number;
  avgUnder: number;
  ahLine: number;
  avgAhHome: number;
  avgAhAway: number;
}

export class ExperimentRunner {
  private config: ExperimentConfig;

  constructor(config: ExperimentConfig) {
    this.config = config;
  }

  private parseDate(dateStr: string): number {
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      return new Date(year, month, day).getTime();
    }
    return new Date(dateStr).getTime();
  }

  private parseCSV(filePath: string, season: string): MatchRow[] {
    if (!fs.existsSync(filePath)) return [];
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const lines = fileContent.split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',');
    const getIndex = (name: string) => headers.indexOf(name);

    const idxDate = getIndex('Date');
    const idxHome = getIndex('HomeTeam');
    const idxAway = getIndex('AwayTeam');
    const idxFTHG = getIndex('FTHG');
    const idxFTAG = getIndex('FTAG');
    const idxFTR = getIndex('FTR');
    const idxAvgH = getIndex('AvgH');
    const idxAvgD = getIndex('AvgD');
    const idxAvgA = getIndex('AvgA');
    const idxAvgOver = getIndex('Avg>2.5');
    const idxAvgUnder = getIndex('Avg<2.5');
    const idxAHh = getIndex('AHh');
    const idxAvgAHH = getIndex('AvgAHH');
    const idxAvgAHA = getIndex('AvgAHA');

    const rows: MatchRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const cols = line.split(',');
      if (cols.length < headers.length) continue;

      const homeTeam = cols[idxHome];
      const awayTeam = cols[idxAway];
      if (!homeTeam || !awayTeam) continue;

      const fthg = parseInt(cols[idxFTHG], 10);
      const ftag = parseInt(cols[idxFTAG], 10);
      const avgH = parseFloat(cols[idxAvgH]);
      const avgD = parseFloat(cols[idxAvgD]);
      const avgA = parseFloat(cols[idxAvgA]);
      const avgOver = parseFloat(cols[idxAvgOver]);
      const avgUnder = parseFloat(cols[idxAvgUnder]);
      const ahLine = parseFloat(cols[idxAHh]);
      const avgAhHome = parseFloat(cols[idxAvgAHH]);
      const avgAhAway = parseFloat(cols[idxAvgAHA]);

      rows.push({
        dateStr: cols[idxDate],
        timestamp: this.parseDate(cols[idxDate]),
        season,
        homeTeam,
        awayTeam,
        fthg,
        ftag,
        ftr: cols[idxFTR],
        avgH: isNaN(avgH) ? 2.0 : avgH,
        avgD: isNaN(avgD) ? 3.0 : avgD,
        avgA: isNaN(avgA) ? 3.5 : avgA,
        avgOver: isNaN(avgOver) ? 1.95 : avgOver,
        avgUnder: isNaN(avgUnder) ? 1.95 : avgUnder,
        ahLine: isNaN(ahLine) ? 0.0 : ahLine,
        avgAhHome: isNaN(avgAhHome) ? 1.95 : avgAhHome,
        avgAhAway: isNaN(avgAhAway) ? 1.95 : avgAhAway
      });
    }

    return rows;
  }

  public async run(): Promise<ExperimentMetrics> {
    const dataDir = path.join(process.cwd(), 'data', 'EPL');
    let allMatches: MatchRow[] = [];
    this.config.seasons.forEach(season => {
      const csvPath = path.join(dataDir, `${season}.csv`);
      allMatches = allMatches.concat(this.parseCSV(csvPath, season));
    });

    allMatches.sort((a, b) => a.timestamp - b.timestamp);

    // Track active teams per season to identify promoted teams
    const teamsBySeason: Record<string, Set<string>> = {};
    allMatches.forEach(m => {
      if (!teamsBySeason[m.season]) teamsBySeason[m.season] = new Set();
      teamsBySeason[m.season].add(m.homeTeam);
      teamsBySeason[m.season].add(m.awayTeam);
    });

    const eloRatings: Record<string, number> = {};
    const matchHistory: Record<string, { date: number; goalsFor: number; goalsAgainst: number; resultPoints: number }[]> = {};

    const getElo = (team: string, season: string) => {
      if (eloRatings[team] !== undefined) {
        return eloRatings[team];
      }

      // Feature Flag: promoted_team_adjustment
      if (this.config.featureFlags.promoted_team_adjustment && season !== '2020-2021') {
        const prevSeasonIndex = this.config.seasons.indexOf(season) - 1;
        if (prevSeasonIndex >= 0) {
          const prevSeason = this.config.seasons[prevSeasonIndex];
          const wasInPrevSeason = teamsBySeason[prevSeason]?.has(team);
          if (!wasInPrevSeason) {
            // Newly promoted team! Start at 1350 instead of 1500
            return 1350;
          }
        }
      }

      return 1500;
    };
    
    const getPreMatchStats = (team: string, dateTimestamp: number) => {
      const history = matchHistory[team] || [];
      const priorHistory = history.filter(h => h.date < dateTimestamp);
      
      const formLast5 = priorHistory.slice(-5).map(h => h.resultPoints);
      while (formLast5.length < 5) formLast5.unshift(1);

      const weights = [0.6, 0.8, 1.0, 1.2, 1.4];
      let weightedSum = 0;
      let weightTotal = 0;
      formLast5.forEach((points, idx) => {
        weightedSum += points * weights[idx];
        weightTotal += weights[idx];
      });
      const formWeighted = weightedSum / weightTotal;

      const previousMatch = priorHistory[priorHistory.length - 1];
      const restDays = previousMatch 
        ? Math.max(1, Math.round((dateTimestamp - previousMatch.date) / (24 * 60 * 60 * 1000)))
        : 7;

      const xgHistory = priorHistory.slice(-5).map(h => (h as any).xgFor ?? h.goalsFor);
      while (xgHistory.length < 5) xgHistory.unshift(1.35);
      const xgRolling5 = xgHistory.reduce((sum, val) => sum + val, 0) / 5;

      const xgaHistory = priorHistory.slice(-5).map(h => (h as any).xgAgainst ?? h.goalsAgainst);
      while (xgaHistory.length < 5) xgaHistory.unshift(1.35);
      const xgaRolling5 = xgaHistory.reduce((sum, val) => sum + val, 0) / 5;

      return {
        formLast5,
        formWeighted,
        restDays,
        xgRolling5,
        xgaRolling5
      };
    };

    const updateTeamState = (team: string, dateTimestamp: number, goalsFor: number, goalsAgainst: number, points: number, xgFor?: number, xgAgainst?: number) => {
      if (!matchHistory[team]) matchHistory[team] = [];
      matchHistory[team].push({
        date: dateTimestamp,
        goalsFor,
        goalsAgainst,
        resultPoints: points,
        xgFor: xgFor ?? goalsFor,
        xgAgainst: xgAgainst ?? goalsAgainst
      } as any);
    };

    const bets: SimulatedBet[] = [];

    for (let i = 0; i < allMatches.length; i++) {
      const m = allMatches[i];
      if (isNaN(m.fthg) || isNaN(m.ftag)) continue;

      // Reset Elo at start of season if carry_over_elo is disabled
      if (!this.config.featureFlags.carry_over_elo && i > 0 && allMatches[i-1].season !== m.season) {
        Object.keys(eloRatings).forEach(k => delete eloRatings[k]);
      }

      const homeElo = getElo(m.homeTeam, m.season);
      const awayElo = getElo(m.awayTeam, m.season);
      const eloDelta = homeElo - awayElo;

      const homeStats = getPreMatchStats(m.homeTeam, m.timestamp);
      const awayStats = getPreMatchStats(m.awayTeam, m.timestamp);

      // Feature Flag: double_home_modifier_fix
      const homeAdvMultiplier = this.config.featureFlags.double_home_modifier_fix
        ? 1.0
        : this.config.parameters.home_advantage_multiplier;

      let homeAttack = (homeElo / 1500) * homeAdvMultiplier;
      let homeDefense = 1500 / homeElo;
      let awayAttack = awayElo / 1500;
      let awayDefense = 1500 / awayElo;

      if (this.config.featureFlags.xg_integration) {
        homeAttack = (homeStats.xgRolling5 / 1.35) * homeAdvMultiplier;
        homeDefense = homeStats.xgaRolling5 / 1.35;
        awayAttack = awayStats.xgRolling5 / 1.35;
        awayDefense = awayStats.xgaRolling5 / 1.35;
      }

      const applySquadValueAdjustment = () => {
        const homeSquadVal = Math.pow(homeElo / 1500, 3);
        const awaySquadVal = Math.pow(awayElo / 1500, 3);
        const logRatio = Math.log(homeSquadVal / awaySquadVal);
        const scaledDelta = Math.tanh(logRatio * 0.2); // smooth bounded delta between -1.0 and 1.0

        // Restrict adjustment to +/- 10% maximum to prevent parameter stretching
        homeAttack *= (1.0 + scaledDelta * 0.1);
        awayAttack *= (1.0 - scaledDelta * 0.1);
      };

      const applyCongestionAdjustment = () => {
        const homeInjuryMult = homeStats.restDays < 4 ? 0.96 : 0.99;
        const awayInjuryMult = awayStats.restDays < 4 ? 0.96 : 0.99;
        homeAttack *= homeInjuryMult;
        awayAttack *= awayInjuryMult;
      };

      if (this.config.featureFlags.squad_dynamics_value_only) {
        applySquadValueAdjustment();
      } else if (this.config.featureFlags.squad_dynamics_congestion_only) {
        applyCongestionAdjustment();
      } else if (this.config.featureFlags.squad_dynamics) {
        applySquadValueAdjustment();
        applyCongestionAdjustment();
      }

      const features: MatchFeatures = {
        matchId: `match-${i}`,
        marketType: 'ML',
        kickoffAt: new Date(m.timestamp),
        homeFormLast5: homeStats.formLast5,
        awayFormLast5: awayStats.formLast5,
        homeFormWeighted: homeStats.formWeighted,
        awayFormWeighted: awayStats.formWeighted,
        homeRestDays: homeStats.restDays,
        awayRestDays: awayStats.restDays,
        homeTravelKm: 0,
        homeElo,
        awayElo,
        eloDelta,
        homeAttack,
        homeDefense,
        awayAttack,
        awayDefense,
        leagueAvgGoals: 2.82,
        isHomeAdvantage: true,
        leagueId: '39',
        season: m.season,
        generatedAt: new Date(m.timestamp - 3600 * 1000)
      };

      const probOutput = await ProbabilityEngine.predict(features, {
        weights: { poisson: 0.5, dixonColes: 0.5 },
        calibrationMethod: this.config.featureFlags.calibration_method,
        plattA: this.config.parameters.platt_a,
        plattB: this.config.parameters.platt_b
      });

      const oddsSnap: BookmakerOddsSnapshot = {
        bookmaker: 'Average',
        moneyline: {
          home: { current: m.avgH },
          draw: { current: m.avgD },
          away: { current: m.avgA }
        },
        overUnder: {
          '2.5': {
            over: { current: m.avgOver },
            under: { current: m.avgUnder }
          }
        },
        asianHandicap: {
          [m.ahLine.toString()]: {
            home: { current: m.avgAhHome },
            away: { current: m.avgAhAway }
          }
        }
      };

      const edges = EdgeEngine.calculateEdges(probOutput, oddsSnap);

      const recommendations: any[] = [];

      edges.forEach(edge => {
        const decision = DecisionEngine.evaluateDecision(
          features.matchId,
          edge,
          this.config.parameters.model_confidence_score,
          this.config.parameters.data_quality_score
        );
        
        let rawP = 0.5;
        let calP = 0.5;
        if (edge.market === 'Moneyline Home') {
          rawP = probOutput.pHome - 0.02; calP = probOutput.pHome;
        } else if (edge.market === 'Moneyline Away') {
          rawP = probOutput.pAway - 0.01; calP = probOutput.pAway;
        } else if (edge.market === 'Moneyline Draw') {
          rawP = probOutput.pDraw; calP = probOutput.pDraw;
        } else if (edge.market.startsWith('Over ')) {
          const line = edge.market.split(' ')[1];
          rawP = (probOutput.pOver[line] || 0.5) - 0.02; calP = probOutput.pOver[line] || 0.5;
        } else if (edge.market.startsWith('Under ')) {
          const line = edge.market.split(' ')[1];
          rawP = (probOutput.pUnder[line] || 0.5) - 0.01; calP = probOutput.pUnder[line] || 0.5;
        }

        const rec = RecommendationEngine.generateRecommendation(decision, rawP, calP);
        if (rec.decision === 'VALUE' || rec.decision === 'STRONG_VALUE') {
          recommendations.push(rec);
        }
      });

      let selectedRecs = recommendations;
      if (this.config.featureFlags.single_bet_per_match) {
        let bestRec: any = null;
        let highestEV = 0.0;
        recommendations.forEach(rec => {
          if (rec.expected_value > highestEV) {
            highestEV = rec.expected_value;
            bestRec = rec;
          }
        });
        selectedRecs = bestRec ? [bestRec] : [];
      }

      selectedRecs.forEach(rec => {
        const isWarm = m.season !== '2020-2021';
        if (isWarm) {
          let stakeSize = rec.recommended_stake * 2.0;

          // Feature Flag: favorite_longshot_adjustment
          if (this.config.featureFlags.favorite_longshot_adjustment && rec.market_odds > 3.0) {
            stakeSize *= 0.5; // Shave stake on volatile underdogs
          }

          const isHomeWin = m.fthg > m.ftag;
          const isDraw = m.fthg === m.ftag;
          const isAwayWin = m.fthg < m.ftag;
          const totalGoals = m.fthg + m.ftag;

          let isWin = false;
          if (rec.market === 'Moneyline Home' && isHomeWin) isWin = true;
          if (rec.market === 'Moneyline Draw' && isDraw) isWin = true;
          if (rec.market === 'Moneyline Away' && isAwayWin) isWin = true;
          if (rec.market.startsWith('Over ')) {
            const line = parseFloat(rec.market.split(' ')[1]);
            if (totalGoals > line) isWin = true;
          }
          if (rec.market.startsWith('Under ')) {
            const line = parseFloat(rec.market.split(' ')[1]);
            if (totalGoals < line) isWin = true;
          }

          const profit = isWin ? stakeSize * (rec.market_odds - 1) : -stakeSize;

          bets.push({
            matchId: features.matchId,
            date: m.dateStr,
            homeTeam: m.homeTeam,
            awayTeam: m.awayTeam,
            market: rec.market,
            odds: rec.market_odds,
            modelProb: rec.calibrated_probability,
            edge: rec.edge,
            stake: stakeSize,
            profit,
            isWin
          });
        }
      });

      const We = 1 / (Math.pow(10, -eloDelta / 400) + 1);
      const W = m.ftr === 'H' ? 1.0 : m.ftr === 'D' ? 0.5 : 0.0;
      const newHomeElo = homeElo + this.config.parameters.elo_k_factor * (W - We);
      const newAwayElo = awayElo + this.config.parameters.elo_k_factor * ((1.0 - W) - (1.0 - We));

      eloRatings[m.homeTeam] = newHomeElo;
      eloRatings[m.awayTeam] = newAwayElo;

      const xgFor = m.fthg + (i % 2 === 0 ? 0.2 : -0.2);
      const xgAgainst = m.ftag + (i % 2 === 0 ? -0.2 : 0.2);

      updateTeamState(m.homeTeam, m.timestamp, m.fthg, m.ftag, W === 1.0 ? 3 : W === 0.5 ? 1 : 0, xgFor, xgAgainst);
      updateTeamState(m.awayTeam, m.timestamp, m.ftag, m.fthg, W === 0.0 ? 3 : W === 0.5 ? 1 : 0, xgAgainst, xgFor);
    }

    return MetricsEngine.calculate(bets);
  }
}
