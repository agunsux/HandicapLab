import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

export interface RawTeamMatchRecord {
  match_id: string;
  team_id: string;
  side: 'HOME' | 'AWAY';
  match_slug: string;
  total_scoring_att?: number | null;
  ontarget_scoring_att?: number | null;
  attempts_ibox?: number | null;
  pen_area_entries?: number | null;
  touches_in_opp_box?: number | null;
  final_third_entries?: number | null;
  total_tackle?: number | null;
  interception?: number | null;
  ball_recovery?: number | null;
  corner_taken?: number | null;
  goals?: number | null;
  goals_conceded?: number | null;
  accurate_pass?: number | null;
  total_pass?: number | null;
  accurate_cross?: number | null;
  total_cross?: number | null;
  [key: string]: any;
}

export interface MultiWindowFeatureVector {
  canonicalId: string;
  matchId: string;
  date: string;
  season: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  homeGoals: number;
  awayGoals: number;
  totalGoals: number;
  goalDiff: number;
  btts: boolean;
  features: Record<string, number>;
  leagueRelativeFeatures: Record<string, number>;
}

export class DribbleMultiWindowFeatureLab {
  private teamHistory = new Map<string, Array<{ matchId: string; date: string; stats: RawTeamMatchRecord }>>();
  private matchMap = new Map<string, {
    date: string;
    league: string;
    season: string;
    homeTeamName: string;
    awayTeamName: string;
    homeTeamId: string;
    awayTeamId: string;
    HOME?: RawTeamMatchRecord;
    AWAY?: RawTeamMatchRecord;
  }>();

  private leagueTeams = new Map<string, Set<string>>();

  private identifyLeague(homeTeam: string, awayTeam: string): string {
    const teams = `${homeTeam} ${awayTeam}`.toLowerCase();
    if (teams.match(/arsenal|chelsea|liverpool|manchester-united|manchester-city|tottenham|everton|aston-villa/)) return 'EPL';
    if (teams.match(/real-madrid|barcelona|atletico-de-madrid|sevilla|villarreal/)) return 'La Liga';
    if (teams.match(/inter|ac-milan|juventus|napoli|roma|lazio|atalanta|fiorentina/)) return 'Serie A';
    if (teams.match(/bayern-munich|borussia-dortmund|bayer-leverkusen/)) return 'Bundesliga';
    if (teams.match(/paris-saint-germain|marseille|lyon|monaco/)) return 'Ligue 1';
    if (teams.match(/ajax|psv|feyenoord|az-alkmaar/)) return 'Eredivisie';
    return 'OTHER';
  }

  private getSeason(date: string): string {
    const [yyyy, mm] = date.split('-');
    const year = parseInt(yyyy, 10);
    const month = parseInt(mm, 10);
    if (month >= 7) {
      return `${year}_${year + 1}`;
    } else {
      return `${year - 1}_${year}`;
    }
  }

  public async initialize(): Promise<void> {
    console.log('[DribbleMultiWindowFeatureLab] Initializing...');
    const harvestDir = path.resolve('data/research/dribble360/harvest');
    const teamMatchFiles = fs.readdirSync(harvestDir).filter(f => f.startsWith('team_matches_') && f.endsWith('.jsonl'));

    for (const f of teamMatchFiles) {
      const fPath = path.join(harvestDir, f);
      if (fs.statSync(fPath).size === 0) continue;

      const fileStream = fs.createReadStream(fPath, { encoding: 'utf8' });
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

      for await (const line of rl) {
        if (!line.trim()) continue;
        try {
          const row: RawTeamMatchRecord = JSON.parse(line);
          const matchId = row.match_id;
          const teamId = row.team_id;
          const side = (row.side || '').toUpperCase() as 'HOME' | 'AWAY';
          const slug = row.match_slug || '';

          // Parse slug: team-a-vs-team-b-DD-MM-YYYY
          const parts = slug.split('-vs-');
          if (parts.length < 2) continue;

          const homeTeamName = parts[0];
          const rest = parts[1];
          const dateStr = rest.slice(-10);
          const awayTeamName = rest.slice(0, -11);

          const [dd, mm, yyyy] = dateStr.split('-');
          const date = `${yyyy}-${mm}-${dd}`;
          const season = this.getSeason(date);
          const league = this.identifyLeague(homeTeamName, awayTeamName);

          if (!this.matchMap.has(matchId)) {
            this.matchMap.set(matchId, {
              date,
              league,
              season,
              homeTeamName,
              awayTeamName,
              homeTeamId: '',
              awayTeamId: ''
            });
          }

          const matchEntry = this.matchMap.get(matchId)!;
          if (side === 'HOME') {
            matchEntry.HOME = row;
            matchEntry.homeTeamId = teamId;
          } else {
            matchEntry.AWAY = row;
            matchEntry.awayTeamId = teamId;
          }

          if (!this.teamHistory.has(teamId)) {
            this.teamHistory.set(teamId, []);
          }
          this.teamHistory.get(teamId)!.push({ matchId, date, stats: row });

          const lsKey = `${league}_${season}`;
          if (!this.leagueTeams.has(lsKey)) {
            this.leagueTeams.set(lsKey, new Set());
          }
          this.leagueTeams.get(lsKey)!.add(teamId);

        } catch (e) {
          // ignore parsing errors
        }
      }
    }

    // Sort histories
    for (const [_, history] of Array.from(this.teamHistory.entries())) {
      history.sort((a, b) => a.date.localeCompare(b.date));
    }

    console.log(`[DribbleMultiWindowFeatureLab] Initialized ${this.teamHistory.size} teams, ${this.matchMap.size} matches.`);
  }

  private getPointInTimeStats(teamId: string, matchDate: string, split: 'overall' | 'home' | 'away', windowSize: number) {
    const history = this.teamHistory.get(teamId) || [];
    let prior = history.filter(h => h.date < matchDate);

    if (split === 'home') {
      prior = prior.filter(h => h.stats.side === 'HOME');
    } else if (split === 'away') {
      prior = prior.filter(h => h.stats.side === 'AWAY');
    }

    const recent = prior.slice(-windowSize);
    const n = recent.length;

    if (n === 0) {
      return {
        avg_shots: 0,
        avg_sot: 0,
        avg_box_entries: 0,
        avg_touches_in_box: 0,
        avg_final_third_entries: 0,
        avg_ibox_attempts: 0,
        avg_defensive_actions: 0,
        avg_corners: 0,
        avg_goals_scored: 0,
        avg_goals_conceded: 0,
        clean_sheet_rate: 0,
        failed_to_score_rate: 0,
        pass_accuracy: 0,
        cross_accuracy: 0
      };
    }

    let shots = 0, sot = 0, boxEntries = 0, touchesBox = 0, ftEntries = 0, iboxAtt = 0, defActions = 0, corners = 0;
    let goals = 0, goalsConceded = 0, cleanSheets = 0, failedToScore = 0;
    let totalPass = 0, accPass = 0, totalCross = 0, accCross = 0;

    for (const h of recent) {
      const s = h.stats;
      shots += s.total_scoring_att || 0;
      sot += s.ontarget_scoring_att || 0;
      boxEntries += s.pen_area_entries || 0;
      touchesBox += s.touches_in_opp_box || 0;
      ftEntries += s.final_third_entries || 0;
      iboxAtt += s.attempts_ibox || 0;
      defActions += (s.total_tackle || 0) + (s.interception || 0) + (s.ball_recovery || 0);
      corners += s.corner_taken || 0;
      
      const g = s.goals || 0;
      const gc = s.goals_conceded || 0;
      goals += g;
      goalsConceded += gc;
      if (gc === 0) cleanSheets++;
      if (g === 0) failedToScore++;

      totalPass += s.total_pass || 0;
      accPass += s.accurate_pass || 0;
      totalCross += s.total_cross || 0;
      accCross += s.accurate_cross || 0;
    }

    return {
      avg_shots: shots / n,
      avg_sot: sot / n,
      avg_box_entries: boxEntries / n,
      avg_touches_in_box: touchesBox / n,
      avg_final_third_entries: ftEntries / n,
      avg_ibox_attempts: iboxAtt / n,
      avg_defensive_actions: defActions / n,
      avg_corners: corners / n,
      avg_goals_scored: goals / n,
      avg_goals_conceded: goalsConceded / n,
      clean_sheet_rate: cleanSheets / n,
      failed_to_score_rate: failedToScore / n,
      pass_accuracy: totalPass > 0 ? accPass / totalPass : 0,
      cross_accuracy: totalCross > 0 ? accCross / totalCross : 0
    };
  }

  public buildMultiWindowDataset(): MultiWindowFeatureVector[] {
    console.log('[DribbleMultiWindowFeatureLab] Building dataset...');
    const dataset: MultiWindowFeatureVector[] = [];
    const splits: Array<'overall' | 'home' | 'away'> = ['overall', 'home', 'away'];
    const windows = [3, 5, 8, 10];

    // Caching league metrics for speed
    // key: ${league}_${season}_${date}_${split}_${window} -> stats object
    const leagueStatsCache = new Map<string, Record<string, { mean: number; std: number }>>();

    let count = 0;
    for (const [matchId, m] of Array.from(this.matchMap.entries())) {
      if (!m.HOME || !m.AWAY) continue;

      const homeId = m.homeTeamId;
      const awayId = m.awayTeamId;
      const date = m.date;
      const league = m.league;
      const season = m.season;

      const homeGoals = m.HOME.goals || 0;
      const awayGoals = m.AWAY.goals || 0;

      const features: Record<string, number> = {};
      const leagueRelativeFeatures: Record<string, number> = {};

      for (const window of windows) {
        for (const split of splits) {
          const homeStats = this.getPointInTimeStats(homeId, date, split, window);
          const awayStats = this.getPointInTimeStats(awayId, date, split, window);

          // Store absolute features
          for (const [metric, val] of Object.entries(homeStats)) {
            features[`home_${split}_${metric}_${window}`] = val;
          }
          for (const [metric, val] of Object.entries(awayStats)) {
            features[`away_${split}_${metric}_${window}`] = val;
          }

          // Differentials for AH
          if (split === 'overall') {
            features[`ah_shot_diff_${window}`] = homeStats.avg_shots - awayStats.avg_shots;
            features[`ah_box_entry_diff_${window}`] = homeStats.avg_box_entries - awayStats.avg_box_entries;
            features[`ah_territorial_diff_${window}`] = homeStats.avg_final_third_entries - awayStats.avg_final_third_entries;
            features[`ah_defensive_diff_${window}`] = homeStats.avg_defensive_actions - awayStats.avg_defensive_actions;

            // Combined for OU
            features[`ou_total_ibox_${window}`] = homeStats.avg_ibox_attempts + awayStats.avg_ibox_attempts;
            features[`ou_total_shots_${window}`] = homeStats.avg_shots + awayStats.avg_shots;
            features[`ou_box_danger_${window}`] = (homeStats.avg_touches_in_box + homeStats.avg_box_entries) + 
                                                  (awayStats.avg_touches_in_box + awayStats.avg_box_entries);

            // BTTS Features
            features[`btts_joint_scoring_rate_${window}`] = (1 - homeStats.failed_to_score_rate) * (1 - awayStats.failed_to_score_rate);
            features[`btts_action_intensity_${window}`] = homeStats.avg_box_entries + awayStats.avg_box_entries;
          }

          // League relative features
          const cacheKey = `${league}_${season}_${date}_${split}_${window}`;
          if (!leagueStatsCache.has(cacheKey)) {
            const lsKey = `${league}_${season}`;
            const tIds = this.leagueTeams.get(lsKey) || new Set();
            
            const metricValues: Record<string, number[]> = {};
            for (const tId of Array.from(tIds)) {
              const tStats = this.getPointInTimeStats(tId, date, split, window);
              for (const [metric, val] of Object.entries(tStats)) {
                if (!metricValues[metric]) metricValues[metric] = [];
                metricValues[metric].push(val);
              }
            }

            const statsObj: Record<string, { mean: number; std: number }> = {};
            for (const [metric, vals] of Object.entries(metricValues)) {
              const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
              const variance = vals.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / (vals.length || 1);
              statsObj[metric] = { mean, std: Math.sqrt(variance) };
            }
            leagueStatsCache.set(cacheKey, statsObj);
          }

          const lStats = leagueStatsCache.get(cacheKey)!;
          for (const [metric, val] of Object.entries(homeStats)) {
            const { mean, std } = lStats[metric];
            leagueRelativeFeatures[`home_${split}_${metric}_${window}`] = std === 0 ? 0 : (val - mean) / std;
          }
          for (const [metric, val] of Object.entries(awayStats)) {
            const { mean, std } = lStats[metric];
            leagueRelativeFeatures[`away_${split}_${metric}_${window}`] = std === 0 ? 0 : (val - mean) / std;
          }
        }
      }

      dataset.push({
        canonicalId: matchId,
        matchId,
        date,
        season,
        league,
        homeTeam: m.homeTeamName,
        awayTeam: m.awayTeamName,
        homeGoals,
        awayGoals,
        totalGoals: homeGoals + awayGoals,
        goalDiff: homeGoals - awayGoals,
        btts: homeGoals > 0 && awayGoals > 0,
        features,
        leagueRelativeFeatures
      });

      count++;
      if (count % 1000 === 0) {
        console.log(`[DribbleMultiWindowFeatureLab] Processed ${count} matches...`);
      }
    }

    console.log(`[DribbleMultiWindowFeatureLab] Dataset built with ${dataset.length} vectors.`);
    return dataset;
  }
}
