import { SilverFixture, HistoricalFeatures, GoldDatasetRecord } from '../contracts/types';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export class GoldDatasetBuilder {
  private ahLines = [-2.5, -2.25, -2.0, -1.75, -1.5, -1.25, -1.0, -0.75, -0.5, -0.25, 0.0, 0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5];
  private ouLines = [1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0, 3.25, 3.5];

  private metadata = {
    dataset_version: 'v0.32.0',
    pipeline_version: '1.0.0',
    build_time: new Date().toISOString(),
    git_commit: process.env.GIT_COMMIT || 'unknown',
  };

  public build(fixtures: SilverFixture[], featuresList: HistoricalFeatures[]) {
    const featureMap = new Map<string, HistoricalFeatures>();
    for (const f of featuresList) {
      featureMap.set(f.fixtureId, f);
    }

    const moneyline: GoldDatasetRecord[] = [];
    const asianHandicap: GoldDatasetRecord[] = [];
    const overUnder: GoldDatasetRecord[] = [];

    for (const fixture of fixtures) {
      const features = featureMap.get(fixture.fixtureId);
      if (!features) continue;

      const fthg = fixture.footballData.fthg;
      const ftag = fixture.footballData.ftag;

      // Ensure we extract pure feature dict without metadata keys
      const { fixtureId, timestamp, homeTeam, awayTeam, ...pureFeatures } = features;

      // 1. Moneyline
      let mlTarget = 'D';
      if (fthg > ftag) mlTarget = 'H';
      else if (fthg < ftag) mlTarget = 'A';

      moneyline.push(this.createRecord(fixture, pureFeatures, mlTarget, 'ML'));

      // 2. Asian Handicap
      for (const line of this.ahLines) {
        // Home score adjusted by line.
        // E.g., if line is -0.5, home needs to win by >=1.
        // If line is +0.5, home needs to win or draw.
        const homeAdjusted = fthg + line;
        let ahResult = 'HALF_LOSS'; // default or unhandled
        
        const diff = homeAdjusted - ftag;
        if (diff > 0.25) ahResult = 'WIN';
        else if (diff === 0.25) ahResult = 'HALF_WIN';
        else if (diff === 0) ahResult = 'PUSH';
        else if (diff === -0.25) ahResult = 'HALF_LOSS';
        else ahResult = 'LOSS';

        asianHandicap.push(this.createRecord(fixture, { ...pureFeatures, line }, ahResult, 'AH', line));
      }

      // 3. Over Under
      for (const line of this.ouLines) {
        const total = fthg + ftag;
        let ouResult = 'HALF_LOSS';
        
        const diff = total - line;
        if (diff > 0.25) ouResult = 'WIN'; // Over hits
        else if (diff === 0.25) ouResult = 'HALF_WIN';
        else if (diff === 0) ouResult = 'PUSH';
        else if (diff === -0.25) ouResult = 'HALF_LOSS';
        else ouResult = 'LOSS'; // Under hits

        overUnder.push(this.createRecord(fixture, { ...pureFeatures, line }, ouResult, 'OU', line));
      }
    }

    this.save('moneyline', moneyline);
    this.save('asian_handicap', asianHandicap);
    this.save('over_under', overUnder);
  }

  private createRecord(fixture: SilverFixture, features: any, target: any, market: string, line?: number): GoldDatasetRecord {
    const payload = JSON.stringify({ fixture: fixture.fixtureId, target, market, line });
    const checksum = crypto.createHash('sha256').update(payload).digest('hex');

    return {
      fixtureId: fixture.fixtureId,
      season: fixture.season,
      date: fixture.date,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      features,
      target,
      metadata: {
        ...this.metadata,
        checksum
      }
    };
  }

  private save(market: string, records: GoldDatasetRecord[]) {
    const dir = path.resolve(process.cwd(), `data/gold/${market}`);
    fs.mkdirSync(dir, { recursive: true });
    
    // Group by season to avoid massive single files
    const bySeason = new Map<string, GoldDatasetRecord[]>();
    for (const r of records) {
      if (!bySeason.has(r.season)) bySeason.set(r.season, []);
      bySeason.get(r.season)!.push(r);
    }

    for (const [season, seasonRecords] of bySeason.entries()) {
      fs.writeFileSync(path.join(dir, `${season}.json`), JSON.stringify(seasonRecords, null, 2));
    }
  }
}
