import fs from 'fs';
import path from 'path';
import { FixtureRepository } from '../../domain/dataset/repository';
import { CanonicalFixture } from '../../domain/dataset/canonical';

export class FileFixtureRepository implements FixtureRepository {
  private filePath: string;

  constructor(projectRoot?: string, filename = 'fixtures.json') {
    const root = projectRoot || process.cwd();
    const dir = path.join(root, 'data', 'silver');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.filePath = path.join(dir, filename);
  }

  private readAll(): CanonicalFixture[] {
    if (!fs.existsSync(this.filePath)) return [];
    try {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
    } catch {
      return [];
    }
  }

  private writeAll(fixtures: CanonicalFixture[]): void {
    fs.writeFileSync(this.filePath, JSON.stringify(fixtures, null, 2), 'utf-8');
  }

  public async save(fixture: CanonicalFixture): Promise<void> {
    const list = this.readAll();
    const idx = list.findIndex(f => f.fixtureId === fixture.fixtureId);
    if (idx !== -1) {
      list[idx] = fixture;
    } else {
      list.push(fixture);
    }
    this.writeAll(list);
  }

  public async findById(fixtureId: string): Promise<CanonicalFixture | null> {
    const list = this.readAll();
    return list.find(f => f.fixtureId === fixtureId) || null;
  }

  public async findByNaturalKey(naturalKey: string): Promise<CanonicalFixture | null> {
    const list = this.readAll();
    return list.find(f => f.fixtureNaturalKey === naturalKey) || null;
  }

  public async listAll(): Promise<CanonicalFixture[]> {
    return this.readAll();
  }

  public async findBySeason(competitionId: string, seasonId: string): Promise<CanonicalFixture[]> {
    const list = this.readAll();
    return list.filter(f => f.competitionId === competitionId && f.seasonId === seasonId);
  }
}
