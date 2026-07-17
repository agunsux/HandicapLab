import { SilverFixture, HistoricalFeatures, WalkForwardFold } from '../contracts/types';
import fs from 'fs';
import path from 'path';

export class WalkForwardSplitter {
  public generateSplits(seasons: string[]): WalkForwardFold[] {
    const sortedSeasons = [...seasons].sort();
    const folds: WalkForwardFold[] = [];

    // We need at least 3 seasons to start: e.g. 5 for train, 1 for val, 1 for test
    // Let's implement an expanding window:
    // Train: 2015-2016 to Y-2
    // Val: Y-1
    // Test: Y

    for (let i = 2; i < sortedSeasons.length; i++) {
      const trainSeasons = sortedSeasons.slice(0, i - 1);
      const validationSeasons = [sortedSeasons[i - 1]];
      const testSeasons = [sortedSeasons[i]];

      folds.push({
        trainSeasons,
        validationSeasons,
        testSeasons
      });
    }

    this.save(folds);
    return folds;
  }

  private save(folds: WalkForwardFold[]) {
    const dir = path.resolve(process.cwd(), 'data/walkforward');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'walkforward_folds.json'), JSON.stringify(folds, null, 2));
  }
}
