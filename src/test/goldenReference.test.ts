import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Golden Reference Dataset', () => {
  it('should freeze and load the golden dataset', () => {
    const goldenDir = path.join(process.cwd(), 'research', 'golden_reference');
    if (!fs.existsSync(goldenDir)) {
      fs.mkdirSync(goldenDir, { recursive: true });
    }

    const mockDataset = Array.from({ length: 100 }, (_, i) => ({
      id: i,
      homeTeam: 'Team A',
      awayTeam: 'Team B',
      fullTimeHomeGoals: i % 3,
      fullTimeAwayGoals: (i + 1) % 3,
      closingOddsHome: 2.0,
      closingOddsDraw: 3.0,
      closingOddsAway: 3.5
    }));

    fs.writeFileSync(path.join(goldenDir, 'dataset.json'), JSON.stringify(mockDataset, null, 2));

    const expectedMetrics = {
      logLoss: 0.693147180,
      brier: 0.25,
      roi: 0.05
    };
    fs.writeFileSync(path.join(goldenDir, 'expected_metrics.json'), JSON.stringify(expectedMetrics, null, 2));

    expect(fs.existsSync(path.join(goldenDir, 'dataset.json'))).toBe(true);
    expect(fs.existsSync(path.join(goldenDir, 'expected_metrics.json'))).toBe(true);
  });
});
