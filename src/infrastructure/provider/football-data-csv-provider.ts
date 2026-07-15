import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { HistoricalDataProvider, ProviderCapability } from '../../domain/dataset/provider-interface';
import { CanonicalFixture, CanonicalOdds } from '../../domain/dataset/canonical';
import { TeamRegistry } from '../registry/team-registry';

export class FootballDataCSVProvider implements HistoricalDataProvider {
  public readonly name = 'football-data.co.uk';
  public readonly version = 'v1.2';

  private projectRoot: string;
  private eplDir: string;

  constructor(projectRoot?: string) {
    this.projectRoot = projectRoot || process.cwd();
    this.eplDir = path.join(this.projectRoot, 'data', 'EPL');
    if (!fs.existsSync(this.eplDir)) {
      fs.mkdirSync(this.eplDir, { recursive: true });
    }
  }

  public getCapabilities(): ProviderCapability {
    return {
      supportsMoneyline: true,
      supportsAsianHandicap: true,
      supportsOverUnder: true,
      supportsHistorical: true,
      supportsXG: false
    };
  }

  /**
   * Translates season ID to football-data season string, e.g. '2015-2016' -> '1516'
   */
  private getFDSeasonCode(seasonId: string): string {
    const parts = seasonId.split('-');
    if (parts.length < 2) return '2324';
    return parts[0].substring(2) + parts[1].substring(2);
  }

  /**
   * Ensures CSV file is present, downloading from football-data.co.uk if missing.
   */
  private async ensureCSVFile(seasonId: string): Promise<string> {
    const filePath = path.join(this.eplDir, `${seasonId}.csv`);
    if (fs.existsSync(filePath)) {
      return filePath;
    }

    // Try to download
    const fdSeason = this.getFDSeasonCode(seasonId);
    const url = `https://www.football-data.co.uk/mmz4931/${fdSeason}/E0.csv`;
    console.log(`  [FootballDataCSVProvider] Local file missing. Attempting download from: ${url}`);
    
    try {
      const response = await fetch(url);
      if (response.ok) {
        const text = await response.text();
        fs.writeFileSync(filePath, text, 'utf-8');
        console.log(`  [FootballDataCSVProvider] Saved downloaded CSV to: ${filePath}`);
        return filePath;
      } else {
        console.warn(`  [FootballDataCSVProvider] Download failed: HTTP ${response.status}`);
      }
    } catch (err) {
      console.warn(`  [FootballDataCSVProvider] Network error during download:`, err);
    }

    throw new Error(`[FootballDataCSVProvider] Critical: File not available for season ${seasonId} and provider download failed.`);
  }

  private parseCSVRow(headers: string[], cols: string[]): Record<string, string> {
    const rowObj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      rowObj[h] = cols[idx] || '';
    });
    return rowObj;
  }

  public async fetchFixtures(competitionId: string, seasonId: string): Promise<Partial<CanonicalFixture>[]> {
    const filePath = await this.ensureCSVFile(seasonId);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const fixtures: Partial<CanonicalFixture>[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols.length < headers.length) continue;

      const row = this.parseCSVRow(headers, cols);
      const homeTeam = row.HomeTeam;
      const awayTeam = row.AwayTeam;
      if (!homeTeam || !awayTeam) continue;

      const dateStr = row.Date;
      const timeStr = row.Time || '15:00';
      
      let kickoffISO = new Date().toISOString();
      if (dateStr) {
        const parts = dateStr.includes('-') ? dateStr.split('-') : dateStr.split('/');
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        let year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
        const [hours, minutes] = timeStr.split(':').map(x => parseInt(x, 10) || 0);
        kickoffISO = new Date(Date.UTC(year, month - 1, day, hours, minutes)).toISOString();
      }

      const homeId = TeamRegistry.resolve(homeTeam);
      const awayId = TeamRegistry.resolve(awayTeam);
      const fixtureNaturalKey = `${competitionId}|${seasonId}|${homeId.toUpperCase()}|${awayId.toUpperCase()}|${kickoffISO.substring(0, 10)}`;

      const fixtureId = crypto
        .createHash('sha256')
        .update(fixtureNaturalKey)
        .digest('hex');

      const homeGoals = row.FTHG !== '' ? parseInt(row.FTHG, 10) : null;
      const awayGoals = row.FTAG !== '' ? parseInt(row.FTAG, 10) : null;

      fixtures.push({
        fixtureId,
        fixtureNaturalKey,
        competitionId,
        seasonId,
        homeTeamId: homeId,
        awayTeamId: awayId,
        kickoff: {
          value: kickoffISO,
          source: this.name,
          confidence: 0.99,
          mergeReason: 'highest_confidence'
        },
        homeGoals: {
          value: homeGoals,
          source: this.name,
          confidence: 0.999,
          mergeReason: 'highest_confidence'
        },
        awayGoals: {
          value: awayGoals,
          source: this.name,
          confidence: 0.999,
          mergeReason: 'highest_confidence'
        },
        homeShots: {
          value: row.HS !== '' ? parseInt(row.HS, 10) : null,
          source: this.name,
          confidence: 0.98,
          mergeReason: 'highest_confidence'
        },
        awayShots: {
          value: row.AS !== '' ? parseInt(row.AS, 10) : null,
          source: this.name,
          confidence: 0.98,
          mergeReason: 'highest_confidence'
        },
        homeShotsOnTarget: {
          value: row.HST !== '' ? parseInt(row.HST, 10) : null,
          source: this.name,
          confidence: 0.98,
          mergeReason: 'highest_confidence'
        },
        awayShotsOnTarget: {
          value: row.AST !== '' ? parseInt(row.AST, 10) : null,
          source: this.name,
          confidence: 0.98,
          mergeReason: 'highest_confidence'
        },
        referee: {
          value: row.Referee || null,
          source: this.name,
          confidence: 0.97,
          mergeReason: 'highest_confidence'
        },
        regime: {
          value: seasonId === '2020-2021' ? 'COVID_ClosedDoor' : 'FullCrowd_Normal',
          source: this.name,
          confidence: 0.99,
          mergeReason: 'highest_confidence'
        }
      });
    }

    return fixtures;
  }

  public async fetchOdds(competitionId: string, seasonId: string): Promise<CanonicalOdds[]> {
    const filePath = await this.ensureCSVFile(seasonId);
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(l => l.trim() !== '');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim());
    const allOdds: CanonicalOdds[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (cols.length < headers.length) continue;

      const row = this.parseCSVRow(headers, cols);
      const homeTeam = row.HomeTeam;
      const awayTeam = row.AwayTeam;
      if (!homeTeam || !awayTeam) continue;

      const dateStr = row.Date;
      const timeStr = row.Time || '15:00';
      
      let kickoffISO = new Date().toISOString();
      if (dateStr) {
        const parts = dateStr.includes('-') ? dateStr.split('-') : dateStr.split('/');
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10);
        let year = parseInt(parts[2], 10);
        if (year < 100) year += 2000;
        const [hours, minutes] = timeStr.split(':').map(x => parseInt(x, 10) || 0);
        kickoffISO = new Date(Date.UTC(year, month - 1, day, hours, minutes)).toISOString();
      }

      const homeId = TeamRegistry.resolve(homeTeam);
      const awayId = TeamRegistry.resolve(awayTeam);
      const fixtureNaturalKey = `${competitionId}|${seasonId}|${homeId.toUpperCase()}|${awayId.toUpperCase()}|${kickoffISO.substring(0, 10)}`;

      const fixtureId = crypto
        .createHash('sha256')
        .update(fixtureNaturalKey)
        .digest('hex');

      const addOddsRecord = (provider: string, type: 'home' | 'draw' | 'away', priceStr: string) => {
        const price = parseFloat(priceStr);
        if (isNaN(price) || price <= 1.0) return;

        allOdds.push({
          fixtureId,
          provider,
          marketType: 'ML',
          selection: type,
          oddsDecimal: price,
          impliedProbability: 1 / price,
          fairProbability: 1 / price, // raw implied
          margin: 0.0, // calculated later
          receivedAt: kickoffISO,
          processedTimestamp: new Date().toISOString()
        });
      };

      // Bet365 Moneyline (B365H, B365D, B365A)
      addOddsRecord('Bet365', 'home', row.B365H);
      addOddsRecord('Bet365', 'draw', row.B365D);
      addOddsRecord('Bet365', 'away', row.B365A);

      // Pinnacle Moneyline (PSH, PSD, PSA)
      addOddsRecord('Pinnacle', 'home', row.PSH);
      addOddsRecord('Pinnacle', 'draw', row.PSD);
      addOddsRecord('Pinnacle', 'away', row.PSA);
    }

    return allOdds;
  }
}
