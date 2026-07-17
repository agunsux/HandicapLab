import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';
import { SilverFixture, FootballDataRecord, UnderstatRecord } from '../contracts/types';
import crypto from 'crypto';

export class SilverMergeEngine {
  private registry: Record<string, { aliases: string[] }> = {};
  private aliasMap: Map<string, string> = new Map();

  constructor() {
    this.loadRegistry();
  }

  private loadRegistry() {
    const regPath = path.resolve(process.cwd(), 'data/registry/team_registry.json');
    this.registry = JSON.parse(fs.readFileSync(regPath, 'utf8'));
    for (const [canonical, data] of Object.entries(this.registry)) {
      this.aliasMap.set(canonical.toLowerCase(), canonical); // Self mapping
      for (const alias of data.aliases) {
        this.aliasMap.set(alias.toLowerCase(), canonical);
      }
    }
  }

  private getCanonicalTeam(team: string): string {
    const clean = team.trim().toLowerCase();
    const canon = this.aliasMap.get(clean);
    if (!canon) {
      throw new Error(`Team alias not found in registry: "${team}"`);
    }
    return canon;
  }

  private parseDate(dateStr: string): string {
    // DD/MM/YYYY or DD/MM/YY to YYYY-MM-DD
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      let year = parts[2];
      if (year.length === 2) {
        year = '20' + year;
      }
      return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return dateStr;
  }

  public runMerge(season: string): SilverFixture[] {
    const fdPath = path.resolve(process.cwd(), `data/bronze/football_data/${season}.csv`);
    const usPath = path.resolve(process.cwd(), `data/bronze/EPL/${season}_understat.json`);

    if (!fs.existsSync(fdPath) || !fs.existsSync(usPath)) {
      console.warn(`Missing bronze data for season ${season}`);
      return [];
    }

    const fdRaw = fs.readFileSync(fdPath, 'utf8');
    const fdRecords: any[] = parse(fdRaw, { columns: true, skip_empty_lines: true, trim: true });

    const usRaw = fs.readFileSync(usPath, 'utf8');
    const usRecords: any[] = JSON.parse(usRaw);

    const merged: SilverFixture[] = [];

    // Map understat by date and home team
    const usMap = new Map<string, any>();
    for (const us of usRecords) {
      // Understat from Epic 31b has fixtureNaturalKey: EPL|2023-2024|ARSENAL|CHELSEA|2023-09-11
      const parts = us.fixtureNaturalKey.split('|');
      const date = parts[4]; // Extract date
      const homeCanon = parts[2];
      usMap.set(`${date}_${homeCanon}`, us);
    }

    for (const fd of fdRecords) {
      if (!fd.Date || !fd.HomeTeam || !fd.AwayTeam) continue;

      const date = this.parseDate(fd.Date);
      const homeCanon = this.getCanonicalTeam(fd.HomeTeam);
      const awayCanon = this.getCanonicalTeam(fd.AwayTeam);

      const timestamp = new Date(date + 'T' + (fd.Time || '15:00:00') + 'Z').getTime();

      const usMatch = usMap.get(`${date}_${homeCanon}`);

      const fixtureId = crypto.createHash('sha256').update(`EPL|${season}|${homeCanon}|${awayCanon}|${date}`).digest('hex');

      const footballDataRecord: FootballDataRecord = {
        date,
        homeTeam: homeCanon,
        awayTeam: awayCanon,
        fthg: parseInt(fd.FTHG),
        ftag: parseInt(fd.FTAG),
        hs: parseInt(fd.HS),
        as: parseInt(fd.AS),
        hst: parseInt(fd.HST),
        ast: parseInt(fd.AST),
        hc: parseInt(fd.HC),
        ac: parseInt(fd.AC),
        hy: parseInt(fd.HY),
        ay: parseInt(fd.AY),
        hr: parseInt(fd.HR),
        ar: parseInt(fd.AR),
        b365h: parseFloat(fd.B365H || fd.MaxH || '0'),
        b365d: parseFloat(fd.B365D || fd.MaxD || '0'),
        b365a: parseFloat(fd.B365A || fd.MaxA || '0'),
        // AH and OU lines to be extracted
      };

      // Add all market data to footballDataRecord
      for (const [k, v] of Object.entries(fd)) {
        footballDataRecord[k] = v;
      }

      const understatRecord: UnderstatRecord = {
        date,
        homeTeam: homeCanon,
        awayTeam: awayCanon,
        homeXg: usMatch ? usMatch.homeXg?.value : 0,
        awayXg: usMatch ? usMatch.awayXg?.value : 0,
        homeGoals: usMatch ? usMatch.homeGoals?.value : footballDataRecord.fthg,
        awayGoals: usMatch ? usMatch.awayGoals?.value : footballDataRecord.ftag,
      };

      const payload = JSON.stringify({ fd: footballDataRecord, us: understatRecord });
      const checksum = crypto.createHash('md5').update(payload).digest('hex');

      merged.push({
        fixtureId,
        date,
        timestamp,
        season,
        homeTeam: homeCanon,
        awayTeam: awayCanon,
        footballData: footballDataRecord,
        understat: understatRecord,
        metadata: {
          mergeConfidence: usMatch ? 1.0 : 0.5, // 0.5 if no understat match found
          checksum
        }
      });
    }

    return merged.sort((a, b) => a.timestamp - b.timestamp);
  }

  public saveSilver(season: string, fixtures: SilverFixture[]) {
    const dir = path.resolve(process.cwd(), 'data/silver/EPL');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${season}.json`), JSON.stringify(fixtures, null, 2));
  }
}
