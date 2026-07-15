import fs from 'fs';
import path from 'path';
import { GoldenDatasetRepository } from '../../domain/dataset/repository';
import { CanonicalFixture } from '../../domain/dataset/canonical';

export class FileGoldenDatasetRepository implements GoldenDatasetRepository {
  private dirPath: string;
  private jsonPath: string;
  private csvPath: string;

  constructor(projectRoot?: string) {
    const root = projectRoot || process.cwd();
    this.dirPath = path.join(root, 'data', 'golden');
    if (!fs.existsSync(this.dirPath)) {
      fs.mkdirSync(this.dirPath, { recursive: true });
    }
    this.jsonPath = path.join(this.dirPath, 'fixtures.json');
    this.csvPath = path.join(this.dirPath, 'golden_matches.csv');
  }

  private readAll(): CanonicalFixture[] {
    if (!fs.existsSync(this.jsonPath)) return [];
    try {
      return JSON.parse(fs.readFileSync(this.jsonPath, 'utf-8'));
    } catch {
      return [];
    }
  }

  public async saveGoldenFixtures(fixtures: CanonicalFixture[]): Promise<void> {
    // Assert unique fixtures
    const uniqueMap = new Map<string, CanonicalFixture>();
    fixtures.forEach(f => uniqueMap.set(f.fixtureId, f));
    const uniqueFixtures = Array.from(uniqueMap.values());

    fs.writeFileSync(this.jsonPath, JSON.stringify(uniqueFixtures, null, 2), 'utf-8');

    // Also output CSV format
    const headers = ['fixtureId', 'fixtureNaturalKey', 'competitionId', 'seasonId', 'homeTeamId', 'awayTeamId', 'kickoff', 'homeGoals', 'awayGoals', 'regime'];
    const rows = [headers.join(',')];
    uniqueFixtures.forEach(f => {
      rows.push([
        f.fixtureId,
        f.fixtureNaturalKey,
        f.competitionId,
        f.seasonId,
        f.homeTeamId,
        f.awayTeamId,
        f.kickoff.value || '',
        f.homeGoals.value ?? '',
        f.awayGoals.value ?? '',
        f.regime.value || ''
      ].join(','));
    });
    fs.writeFileSync(this.csvPath, rows.join('\n'), 'utf-8');
  }

  public async getGoldenFixtures(): Promise<CanonicalFixture[]> {
    return this.readAll();
  }

  public classifyFixture(fixture: CanonicalFixture): string[] {
    const categories: string[] = [];

    const homeGoals = fixture.homeGoals.value ?? 0;
    const awayGoals = fixture.awayGoals.value ?? 0;
    const regime = fixture.regime.value || 'FullCrowd_Normal';
    const season = fixture.seasonId;
    const home = fixture.homeTeamId;
    const away = fixture.awayTeamId;

    // 1. Home Favorite / Away Favorite / Draw
    if (homeGoals > awayGoals) {
      categories.push('home_favorite');
    } else if (awayGoals > homeGoals) {
      categories.push('away_favorite');
    } else {
      categories.push('draw');
    }

    // 2. COVID
    if (regime.includes('COVID')) {
      categories.push('covid');
    }

    // 3. VAR (19/20 season onwards)
    const startYear = parseInt(season.split('-')[0], 10);
    if (startYear >= 2019) {
      categories.push('var');
    }

    // 4. Congested (deterministic based on fixture index for simulation)
    const numericId = parseInt(fixture.fixtureId.substring(0, 4), 16) || 0;
    if (numericId % 7 === 0) {
      categories.push('congested');
    }

    // 5. Big Six
    const bigSix = ['arsenal', 'chelsea', 'liverpool', 'manchesterunited', 'manchestercity', 'tottenham'];
    if (bigSix.includes(home) && bigSix.includes(away)) {
      categories.push('big_six');
    }

    // 6. Relegation Battle
    const relegationTeams = ['burnley', 'watford', 'norwich', 'luton', 'sunderland', 'hull', 'middlesbrough'];
    if (relegationTeams.includes(home) || relegationTeams.includes(away)) {
      categories.push('relegation_battle');
    }

    // 7. Mid Table
    if (!bigSix.includes(home) && !bigSix.includes(away) && !relegationTeams.includes(home) && !relegationTeams.includes(away)) {
      categories.push('mid_table');
    }

    return categories;
  }

  public async verifyCategoryBalance(expectedCategories: Record<string, number>): Promise<{
    passed: boolean;
    counts: Record<string, number>;
    errors: string[];
  }> {
    const fixtures = this.readAll();
    const counts: Record<string, number> = {};
    Object.keys(expectedCategories).forEach(cat => {
      counts[cat] = 0;
    });

    fixtures.forEach(f => {
      const cats = this.classifyFixture(f);
      cats.forEach(c => {
        if (c in counts) {
          counts[c]++;
        }
      });
    });

    const errors: string[] = [];
    Object.entries(expectedCategories).forEach(([cat, target]) => {
      if (counts[cat] < target) {
        errors.push(`Category '${cat}' under-represented: target is ${target}, got ${counts[cat]}`);
      }
    });

    return {
      passed: errors.length === 0,
      counts,
      errors
    };
  }
}
