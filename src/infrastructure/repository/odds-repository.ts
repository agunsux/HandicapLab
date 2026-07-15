import fs from 'fs';
import path from 'path';
import { OddsRepository } from '../../domain/dataset/repository';
import { CanonicalOdds } from '../../domain/dataset/canonical';

export class FileOddsRepository implements OddsRepository {
  private filePath: string;

  constructor(projectRoot?: string, filename = 'odds.json') {
    const root = projectRoot || process.cwd();
    const dir = path.join(root, 'data', 'silver');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.filePath = path.join(dir, filename);
  }

  private readAll(): CanonicalOdds[] {
    if (!fs.existsSync(this.filePath)) return [];
    try {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
    } catch {
      return [];
    }
  }

  private writeAll(oddsList: CanonicalOdds[]): void {
    fs.writeFileSync(this.filePath, JSON.stringify(oddsList, null, 2), 'utf-8');
  }

  public async saveOdds(odds: CanonicalOdds[]): Promise<void> {
    const list = this.readAll();
    odds.forEach(newOdds => {
      const idx = list.findIndex(
        o =>
          o.fixtureId === newOdds.fixtureId &&
          o.provider === newOdds.provider &&
          o.marketType === newOdds.marketType &&
          o.selection === newOdds.selection
      );
      if (idx !== -1) {
        list[idx] = newOdds;
      } else {
        list.push(newOdds);
      }
    });
    this.writeAll(list);
  }

  public async findByFixtureId(fixtureId: string): Promise<CanonicalOdds[]> {
    const list = this.readAll();
    return list.filter(o => o.fixtureId === fixtureId);
  }

  public async listAll(): Promise<CanonicalOdds[]> {
    return this.readAll();
  }
}
