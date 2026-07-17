import { SilverFixture, HistoricalFeatures } from '../contracts/types';
import fs from 'fs';
import path from 'path';

export class FeatureStore {
  private allFixtures: SilverFixture[] = [];
  
  public loadFixtures(fixtures: SilverFixture[]) {
    // Combine and sort chronologically
    this.allFixtures = [...this.allFixtures, ...fixtures].sort((a, b) => a.timestamp - b.timestamp);
  }

  public generateFeatures(): HistoricalFeatures[] {
    const features: HistoricalFeatures[] = [];
    
    // Sort just in case
    this.allFixtures.sort((a, b) => a.timestamp - b.timestamp);
    
    for (const fixture of this.allFixtures) {
      // STRICT Leakage Prevention: Only look at fixtures before matchDate - 1 second
      const cutoffTime = fixture.timestamp - 1000;
      
      const homePast = this.allFixtures.filter(f => 
        (f.homeTeam === fixture.homeTeam || f.awayTeam === fixture.homeTeam) && 
        f.timestamp <= cutoffTime
      );
      
      const awayPast = this.allFixtures.filter(f => 
        (f.homeTeam === fixture.awayTeam || f.awayTeam === fixture.awayTeam) && 
        f.timestamp <= cutoffTime
      );

      const fixtureFeatures: HistoricalFeatures = {
        fixtureId: fixture.fixtureId,
        timestamp: fixture.timestamp,
        homeTeam: fixture.homeTeam,
        awayTeam: fixture.awayTeam
      };

      const windows = [5, 10, 20];
      
      // Calculate features for Home Team
      this.calculateRollingStats(homePast, fixture.homeTeam, windows, 'home', fixtureFeatures);
      
      // Calculate features for Away Team
      this.calculateRollingStats(awayPast, fixture.awayTeam, windows, 'away', fixtureFeatures);
      
      // H2H features if needed
      // Basic match features
      fixtureFeatures['season'] = fixture.season;
      
      features.push(fixtureFeatures);
    }
    
    return features;
  }

  private calculateRollingStats(
    pastMatches: SilverFixture[], 
    targetTeam: string, 
    windows: number[], 
    prefix: string, 
    features: HistoricalFeatures
  ) {
    // Sort descending by timestamp so index 0 is most recent
    const recent = [...pastMatches].sort((a, b) => b.timestamp - a.timestamp);
    
    for (const w of windows) {
      const windowMatches = recent.slice(0, w);
      if (windowMatches.length === 0) {
        // Fallback for beginning of dataset
        this.fillEmptyWindow(prefix, w, features);
        continue;
      }
      
      let goalsFor = 0;
      let goalsAgainst = 0;
      let xgFor = 0;
      let xgAgainst = 0;
      let shotsFor = 0;
      let shotsAgainst = 0;
      let shotsTargetFor = 0;
      let shotsTargetAgainst = 0;
      let cornersFor = 0;
      let cornersAgainst = 0;
      let points = 0;

      for (const m of windowMatches) {
        const isHome = m.homeTeam === targetTeam;
        
        goalsFor += isHome ? m.footballData.fthg : m.footballData.ftag;
        goalsAgainst += isHome ? m.footballData.ftag : m.footballData.fthg;
        
        xgFor += isHome ? m.understat.homeXg : m.understat.awayXg;
        xgAgainst += isHome ? m.understat.awayXg : m.understat.homeXg;
        
        shotsFor += isHome ? m.footballData.hs : m.footballData.as;
        shotsAgainst += isHome ? m.footballData.as : m.footballData.hs;
        
        shotsTargetFor += isHome ? m.footballData.hst : m.footballData.ast;
        shotsTargetAgainst += isHome ? m.footballData.ast : m.footballData.hst;
        
        cornersFor += isHome ? m.footballData.hc : m.footballData.ac;
        cornersAgainst += isHome ? m.footballData.ac : m.footballData.hc;
        
        const gf = isHome ? m.footballData.fthg : m.footballData.ftag;
        const ga = isHome ? m.footballData.ftag : m.footballData.fthg;
        
        if (gf > ga) points += 3;
        else if (gf === ga) points += 1;
      }

      const n = windowMatches.length;
      
      features[`${prefix}_rolling_goals_for_${w}`] = goalsFor / n;
      features[`${prefix}_rolling_goals_against_${w}`] = goalsAgainst / n;
      features[`${prefix}_rolling_xg_for_${w}`] = xgFor / n;
      features[`${prefix}_rolling_xg_against_${w}`] = xgAgainst / n;
      features[`${prefix}_rolling_shots_for_${w}`] = shotsFor / n;
      features[`${prefix}_rolling_shots_against_${w}`] = shotsAgainst / n;
      features[`${prefix}_rolling_shots_target_for_${w}`] = shotsTargetFor / n;
      features[`${prefix}_rolling_shots_target_against_${w}`] = shotsTargetAgainst / n;
      features[`${prefix}_rolling_corners_for_${w}`] = cornersFor / n;
      features[`${prefix}_rolling_corners_against_${w}`] = cornersAgainst / n;
      features[`${prefix}_rolling_points_${w}`] = points / n;
    }
  }

  private fillEmptyWindow(prefix: string, w: number, features: HistoricalFeatures) {
    features[`${prefix}_rolling_goals_for_${w}`] = 0;
    features[`${prefix}_rolling_goals_against_${w}`] = 0;
    features[`${prefix}_rolling_xg_for_${w}`] = 0;
    features[`${prefix}_rolling_xg_against_${w}`] = 0;
    features[`${prefix}_rolling_shots_for_${w}`] = 0;
    features[`${prefix}_rolling_shots_against_${w}`] = 0;
    features[`${prefix}_rolling_shots_target_for_${w}`] = 0;
    features[`${prefix}_rolling_shots_target_against_${w}`] = 0;
    features[`${prefix}_rolling_corners_for_${w}`] = 0;
    features[`${prefix}_rolling_corners_against_${w}`] = 0;
    features[`${prefix}_rolling_points_${w}`] = 0;
  }

  public saveFeatures(features: HistoricalFeatures[]) {
    const dir = path.resolve(process.cwd(), 'data/features');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'historical_features.json'), JSON.stringify(features, null, 2));
  }
}
