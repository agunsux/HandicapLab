import { SilverFixture, HistoricalFeatures } from '../contracts/types';
import fs from 'fs';
import path from 'path';

export class DatasetValidator {
  public validate(fixtures: SilverFixture[], features: HistoricalFeatures[]) {
    const report = {
      totalFixtures: fixtures.length,
      totalFeatures: features.length,
      seasonsCoverage: {} as Record<string, number>,
      duplicates: 0,
      missingFeatures: 0,
      missingValues: 0,
      integrityPassed: true,
      errors: [] as string[]
    };

    const fixtureIds = new Set<string>();
    
    for (const f of fixtures) {
      if (fixtureIds.has(f.fixtureId)) {
        report.duplicates++;
        report.errors.push(`Duplicate fixture ID found: ${f.fixtureId}`);
      }
      fixtureIds.add(f.fixtureId);

      report.seasonsCoverage[f.season] = (report.seasonsCoverage[f.season] || 0) + 1;
    }

    const featureIds = new Set<string>();
    for (const f of features) {
      featureIds.add(f.fixtureId);
      
      // Check for missing/NaN values
      for (const [k, v] of Object.entries(f)) {
        if (v === null || v === undefined || (typeof v === 'number' && isNaN(v))) {
          report.missingValues++;
          report.errors.push(`Missing/NaN value in feature ${k} for fixture ${f.fixtureId}`);
        }
      }
    }

    for (const f of fixtures) {
      if (!featureIds.has(f.fixtureId)) {
        report.missingFeatures++;
        report.errors.push(`Fixture ${f.fixtureId} has no corresponding features`);
      }
    }

    if (report.duplicates > 0 || report.missingFeatures > 0 || report.missingValues > 0) {
      report.integrityPassed = false;
    }

    this.saveReport(report);
    
    if (!report.integrityPassed) {
      console.warn("Dataset Validation Failed. See report for details.");
    } else {
      console.log("Dataset Validation Passed.");
    }

    return report;
  }

  private saveReport(report: any) {
    const dir = path.resolve(process.cwd(), 'data/reports');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'validation_report.json'), JSON.stringify(report, null, 2));
  }
}
