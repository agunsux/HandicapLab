import fs from 'fs';
import path from 'path';
import { WalkForwardFold, GoldDatasetRecord } from '../contracts/types';

export class ResearchBaselines {
  public evaluate(folds: WalkForwardFold[]) {
    const report = {
      timestamp: new Date().toISOString(),
      models: ['Naive_Baseline', 'Poisson_Expected'],
      results: [] as any[]
    };

    // Evaluate on the most recent test fold as a sample
    if (folds.length > 0) {
      const latestFold = folds[folds.length - 1];
      const testSeason = latestFold.testSeasons[0];
      
      const mlPath = path.resolve(process.cwd(), `data/gold/moneyline/${testSeason}.json`);
      if (fs.existsSync(mlPath)) {
        const records: GoldDatasetRecord[] = JSON.parse(fs.readFileSync(mlPath, 'utf8'));
        
        let correctNaive = 0;
        let correctPoisson = 0;
        let total = 0;

        for (const r of records) {
          total++;
          const actual = r.target; // 'H', 'D', 'A'
          
          // Naive Baseline: Always predict Home Win (historically ~45% in EPL)
          if (actual === 'H') correctNaive++;

          // Basic Poisson proxy using rolling goals
          const homeG = (r.features['home_rolling_goals_for_5'] as number) || 1.5;
          const awayG = (r.features['away_rolling_goals_for_5'] as number) || 1.0;
          
          let pred = 'D';
          if (homeG > awayG + 0.3) pred = 'H';
          else if (awayG > homeG + 0.3) pred = 'A';
          
          if (actual === pred) correctPoisson++;
        }

        report.results.push({
          season: testSeason,
          samples: total,
          naiveAccuracy: total > 0 ? (correctNaive / total).toFixed(4) : "0",
          poissonProxyAccuracy: total > 0 ? (correctPoisson / total).toFixed(4) : "0",
        });
      }
    }

    this.saveReport(report);
  }

  private saveReport(report: any) {
    const dir = path.resolve(process.cwd(), 'data/baselines');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'baseline_report.json'), JSON.stringify(report, null, 2));
    console.log("Research Baselines Evaluation Complete.");
  }
}
