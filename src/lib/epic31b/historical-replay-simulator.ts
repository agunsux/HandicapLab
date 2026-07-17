import fs from 'fs';
import path from 'path';
import { getLeagueConfig } from './league-config';
import type { ReplayOutcome, ReplayMetrics, ValidationReport, ValidationError, LeagueId, MarketType } from './types';
import { PoissonModel } from '../engines/probability-engine/poisson';
import { DixonColesModel } from '../engines/probability-engine/dixon-coles';
import { DeVigService } from '../settlement-core/devig';
import { settleMoneyline } from '../settlement-core/settlement';
import { EdgeScanner } from '../engines/edge-scanner';
import type { ProbabilityOutput } from '../engines/probability-engine/types';
import { RegimeSelector } from '../../domain/dataset/regime-selector';
import { CapitalAllocationEngine } from '../../domain/bankroll/capital-allocation';
import { LeakageAuditor } from '../../application/validation/leakage-auditor';

export interface HistoricalMatch {
  kickoffAt: Date;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  htHomeGoals: number;
  htAwayGoals: number;
  homeOdds: number;
  drawOdds: number;
  awayOdds: number;
  closingHomeOdds: number;
  closingDrawOdds: number;
  closingAwayOdds: number;
}

export class HistoricalReplaySimulator {
  private projectRoot: string;
  private eplDataDir: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
    this.eplDataDir = path.join(this.projectRoot, 'data', 'EPL');
  }

  /**
   * Helper to parse raw football-data.co.uk CSV content
   */
  public parseCsv(content: string): HistoricalMatch[] {
    const lines = content.split(/\r?\n/).filter((line) => line.trim() !== '');
    if (lines.length < 2) return [];
    
    const headers = lines[0].split(',');
    const dateIdx = headers.indexOf('Date');
    const timeIdx = headers.indexOf('Time');
    const homeTeamIdx = headers.indexOf('HomeTeam');
    const awayTeamIdx = headers.indexOf('AwayTeam');
    const fthgIdx = headers.indexOf('FTHG');
    const ftagIdx = headers.indexOf('FTAG');
    const hthgIdx = headers.indexOf('HTHG');
    const htagIdx = headers.indexOf('HTAG');

    // Opening Odds: prefer Pinnacle, fallback to Bet365
    const homeOddsIdx = headers.indexOf('PSH') !== -1 ? headers.indexOf('PSH') : headers.indexOf('B365H');
    const drawOddsIdx = headers.indexOf('PSD') !== -1 ? headers.indexOf('PSD') : headers.indexOf('B365D');
    const awayOddsIdx = headers.indexOf('PSA') !== -1 ? headers.indexOf('PSA') : headers.indexOf('B365A');

    // Closing Odds: prefer Pinnacle, fallback to Bet365
    const closingHomeOddsIdx = headers.indexOf('PSCH') !== -1 ? headers.indexOf('PSCH') : headers.indexOf('B365CH');
    const closingDrawOddsIdx = headers.indexOf('PSCD') !== -1 ? headers.indexOf('PSCD') : headers.indexOf('B365CD');
    const closingAwayOddsIdx = headers.indexOf('PSCA') !== -1 ? headers.indexOf('PSCA') : headers.indexOf('B365CA');

    const matches: HistoricalMatch[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      if (cols.length < headers.length) continue;

      const dateStr = cols[dateIdx];
      if (!dateStr) continue;

      const timeStr = timeIdx !== -1 ? cols[timeIdx] : '15:00';
      
      const dateParts = dateStr.split('/');
      if (dateParts.length !== 3) continue;
      const [d, m, y] = dateParts.map((x) => parseInt(x, 10));

      const timeParts = timeStr.split(':');
      const hh = timeParts.length > 0 ? parseInt(timeParts[0], 10) : 15;
      const mm = timeParts.length > 1 ? parseInt(timeParts[1], 10) : 0;

      const kickoffAt = new Date(y, m - 1, d, hh, mm, 0);

      const homeTeam = cols[homeTeamIdx];
      const awayTeam = cols[awayTeamIdx];
      const homeGoals = parseInt(cols[fthgIdx], 10);
      const awayGoals = parseInt(cols[ftagIdx], 10);
      const htHomeGoals = hthgIdx !== -1 ? parseInt(cols[hthgIdx], 10) : 0;
      const htAwayGoals = htagIdx !== -1 ? parseInt(cols[htagIdx], 10) : 0;

      const homeOdds = parseFloat(cols[homeOddsIdx]);
      const drawOdds = parseFloat(cols[drawOddsIdx]);
      const awayOdds = parseFloat(cols[awayOddsIdx]);

      const closingHomeOdds = parseFloat(cols[closingHomeOddsIdx]);
      const closingDrawOdds = parseFloat(cols[closingDrawOddsIdx]);
      const closingAwayOdds = parseFloat(cols[closingAwayOddsIdx]);

      if (isNaN(homeGoals) || isNaN(awayGoals)) continue;

      matches.push({
        kickoffAt,
        homeTeam,
        awayTeam,
        homeGoals,
        awayGoals,
        htHomeGoals,
        htAwayGoals,
        homeOdds: isNaN(homeOdds) ? 0 : homeOdds,
        drawOdds: isNaN(drawOdds) ? 0 : drawOdds,
        awayOdds: isNaN(awayOdds) ? 0 : awayOdds,
        closingHomeOdds: isNaN(closingHomeOdds) ? 0 : closingHomeOdds,
        closingDrawOdds: isNaN(closingDrawOdds) ? 0 : closingDrawOdds,
        closingAwayOdds: isNaN(closingAwayOdds) ? 0 : closingAwayOdds,
      });
    }

    return matches.sort((a, b) => a.kickoffAt.getTime() - b.kickoffAt.getTime());
  }

  /**
   * Load and parse all Premier League seasons for the VAR era (2020-2024)
   */
  public loadVarEraMatches(): Record<string, HistoricalMatch[]> {
    const seasons = ['2020-2021', '2021-2022', '2022-2023', '2023-2024'];
    const record: Record<string, HistoricalMatch[]> = {};

    for (const season of seasons) {
      const filePath = path.join(this.eplDataDir, `${season}.csv`);
      if (fs.existsSync(filePath)) {
        const csvContent = fs.readFileSync(filePath, 'utf-8');
        record[season] = this.parseCsv(csvContent);
      } else {
        record[season] = [];
      }
    }

    return record;
  }

  /**
   * Run chronological walk-forward historical simulation.
   */
  public async simulateWalkForward(options: {
    model: 'poisson' | 'dixonColes';
    seed?: number;
    rho?: number;
  }): Promise<{
    outcomes: ReplayOutcome[];
    validationReport: ValidationReport;
  }> {
    const seed = options.seed ?? 42;
    const rho = options.rho ?? -0.06;
    const allSeasons = this.loadVarEraMatches();
    
    // Sort chronological seasons
    const seasonsList = Object.keys(allSeasons).sort();
    
    let rawOutcomes: ReplayOutcome[] = [];
    const errors: ValidationError[] = [];
    let validFixtures = 0;
    let missingOdds = 0;

    // Track running history of matches to avoid look-ahead bias
    const history: HistoricalMatch[] = [];

    for (const season of seasonsList) {
      const seasonMatches = allSeasons[season] || [];

      for (const match of seasonMatches) {
        const fixtureId = `EPL-${season}-${match.homeTeam}-${match.awayTeam}`.replace(/\s+/g, '-');
        
        // Audit odds presence
        if (match.homeOdds <= 1 || match.drawOdds <= 1 || match.awayOdds <= 1 ||
            match.closingHomeOdds <= 1 || match.closingDrawOdds <= 1 || match.closingAwayOdds <= 1) {
          missingOdds++;
          errors.push({
            fixtureId,
            field: 'odds',
            message: 'Incomplete opening or closing odds.',
            severity: 'error'
          });
          continue;
        }

        validFixtures++;

        // 1. Extract dynamic team metrics from prior history (zero look-ahead)
        const pastMatches = history.filter((m) => m.kickoffAt.getTime() < match.kickoffAt.getTime());
        const xg = this.calculateLocalXg(pastMatches, match.homeTeam, match.awayTeam);

        // 2. Select structural regimes
        const regimes = RegimeSelector.selectRegime(match.kickoffAt, season, { restDays: 4 });

        // 3. Build match features
        const matchFeatures: any = {
          homeAttack: xg.homeAttack,
          homeDefense: xg.homeDefense,
          awayAttack: xg.awayAttack,
          awayDefense: xg.awayDefense,
          leagueAvgGoals: xg.leagueAvgGoals,
          isHomeAdvantage: true,
          homeRestDays: 4,
          awayRestDays: 4,
          homeTravelKm: 0,
          awayTravelKm: 0,
          competitionType: 'league',
          leagueId: '39',
          season,
          regime: regimes[0],
        };

        // 4. Generate probability predictions (poisson vs dixon-coles)
        let scoreMatrix: number[][];
        if (options.model === 'dixonColes') {
          const res = DixonColesModel.predict(matchFeatures, rho);
          scoreMatrix = res.scoreMatrix;
        } else {
          const res = PoissonModel.predict(matchFeatures);
          scoreMatrix = res.scoreMatrix;
        }

        // Calculate moneyline probabilities from matrix
        let pHome = 0;
        let pDraw = 0;
        let pAway = 0;
        for (let h = 0; h <= 10; h++) {
          for (let a = 0; a <= 10; a++) {
            const p = scoreMatrix[h][a];
            if (h > a) pHome += p;
            else if (h === a) pDraw += p;
            else pAway += p;
          }
        }
        const sum = pHome + pDraw + pAway;
        const mlProb: ProbabilityOutput = {
          matchId: fixtureId,
          marketType: 'ML',
          leagueId: '39',
          pHome: pHome / sum,
          pDraw: pDraw / sum,
          pAway: pAway / sum,
          pOver: {},
          pUnder: {},
          pAhHome: {},
          pAhAway: {},
          modelVersion: {
            name: 'prematch-v1',
            algo: options.model,
            features: 'basic-v1',
            trainedAt: new Date(),
            trainedOnMatches: 1520,
          },
          calibrationApplied: true,
        };

        // 5. Run Edge Scanner and calculate raw stakes
        const marketOdds = {
          homeOdds: match.homeOdds,
          drawOdds: match.drawOdds,
          awayOdds: match.awayOdds,
          line: 0,
        };

        const picks = EdgeScanner.scan(fixtureId, 'ML', mlProb, marketOdds);
        const topPick = picks[0];

        const kellyStake = topPick ? topPick.kellyStake : 0;
        const expectedValue = topPick ? topPick.expectedValue : 0;
        const selection = topPick ? topPick.outcome : 'home';
        const predictedProb = selection === 'home' ? mlProb.pHome : selection === 'draw' ? mlProb.pDraw : mlProb.pAway;

        // 6. Settle match outcome
        const actualResult = match.homeGoals > match.awayGoals ? 1 : match.homeGoals === match.awayGoals ? 0.5 : 0;
        const profitLoss = topPick
          ? (actualResult === 1 ? kellyStake * (topPick.marketOdds - 1) : actualResult === 0.5 ? 0 : -kellyStake)
          : 0;
        const brierScore = Math.pow(predictedProb - actualResult, 2);
        const logLoss = actualResult === 1 ? -Math.log(Math.max(0.001, predictedProb)) : actualResult === 0 ? -Math.log(Math.max(0.001, 1 - predictedProb)) : 0;

        const clv = DeVigService.clv(topPick ? topPick.marketOdds : match.homeOdds, selection === 'home' ? match.closingHomeOdds : selection === 'draw' ? match.closingDrawOdds : match.closingAwayOdds);

        const settlement = settleMoneyline(match.homeGoals, match.awayGoals, selection as 'home' | 'draw' | 'away', topPick ? topPick.marketOdds : match.homeOdds, false);

        rawOutcomes.push({
          fixtureId,
          marketType: 'ML',
          selection,
          predictedProbability: Math.round(predictedProb * 10000) / 10000,
          actualResult,
          profitLoss: Math.round(profitLoss * 10000) / 10000,
          brierScore: Math.round(brierScore * 10000) / 10000,
          logLoss: Math.round(logLoss * 10000) / 10000,
          clv: Math.round(clv * 10000) / 10000,
          kellyStake: Math.round(kellyStake * 10000) / 10000,
          expectedValue: Math.round(expectedValue * 10000) / 10000,
          settledOutcome: settlement.outcome,
          settlementProfitUnits: Math.round(settlement.profitUnits * kellyStake * 10000) / 10000,
          homeGoals: match.homeGoals,
          awayGoals: match.awayGoals,
          leagueId: '39'
        });

        // Add played match to training history (zero look-ahead)
        history.push(match);
      }
    }

    // 7. Apply Capital Allocation Escalator to recommended stakes
    const outcomes = CapitalAllocationEngine.allocate(rawOutcomes, { maxDrawdownLimit: 0.25 }, 0.0);

    // 8. Run Leakage Audit checks
    const allParsedMatches = Object.values(allSeasons).flat();
    const leakageAudit = LeakageAuditor.audit(outcomes, allParsedMatches);
    if (leakageAudit.hasLeakage) {
      for (const leak of leakageAudit.issues) {
        errors.push({
          fixtureId: 'SYSTEM',
          field: 'leakage',
          message: leak,
          severity: 'error',
        });
      }
    }

    const validationReport: ValidationReport = {
      totalFixtures: validFixtures + missingOdds + errors.length,
      validFixtures,
      invalidFixtures: errors.length,
      missingOdds,
      missingResults: 0,
      validationErrors: errors,
    };

    return {
      outcomes,
      validationReport,
    };
  }

  private calculateLocalXg(
    pastMatches: HistoricalMatch[],
    homeTeam: string,
    awayTeam: string
  ): { homeAttack: number; homeDefense: number; awayAttack: number; awayDefense: number; leagueAvgGoals: number } {
    if (pastMatches.length < 10) {
      return { homeAttack: 1.0, homeDefense: 1.0, awayAttack: 1.0, awayDefense: 1.0, leagueAvgGoals: 1.35 };
    }

    // Compute league averages
    let totalHomeGoals = 0;
    let totalAwayGoals = 0;
    let homeMatchCount = 0;
    let awayMatchCount = 0;

    for (const m of pastMatches) {
      totalHomeGoals += m.homeGoals;
      totalAwayGoals += m.awayGoals;
    }

    const avgHomeScored = totalHomeGoals / pastMatches.length;
    const avgAwayScored = totalAwayGoals / pastMatches.length;

    // Team specific scoring/conceding averages
    const homeScored = pastMatches.filter((m) => m.homeTeam === homeTeam).reduce((sum, m) => sum + m.homeGoals, 0);
    const homeConceded = pastMatches.filter((m) => m.homeTeam === homeTeam).reduce((sum, m) => sum + m.awayGoals, 0);
    const homeMatches = pastMatches.filter((m) => m.homeTeam === homeTeam).length || 1;

    const awayScored = pastMatches.filter((m) => m.awayTeam === awayTeam).reduce((sum, m) => sum + m.awayGoals, 0);
    const awayConceded = pastMatches.filter((m) => m.awayTeam === awayTeam).reduce((sum, m) => sum + m.homeGoals, 0);
    const awayMatches = pastMatches.filter((m) => m.awayTeam === awayTeam).length || 1;

    const homeAttack = (homeScored / homeMatches) / (avgHomeScored || 1);
    const homeDefense = (homeConceded / homeMatches) / (avgAwayScored || 1);
    const awayAttack = (awayScored / awayMatches) / (avgAwayScored || 1);
    const awayDefense = (awayConceded / awayMatches) / (avgHomeScored || 1);

    return {
      homeAttack,
      homeDefense,
      awayAttack,
      awayDefense,
      leagueAvgGoals: (avgHomeScored + avgAwayScored) / 2 || 1.35,
    };
  }
}
