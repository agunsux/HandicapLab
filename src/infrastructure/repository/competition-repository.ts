import fs from 'fs';
import path from 'path';
import { CompetitionRepository } from '../../domain/dataset/repository';
import { CanonicalCompetition } from '../../domain/dataset/canonical';
import { CompetitionRegistry } from '../registry/competition-registry';

export class FileCompetitionRepository implements CompetitionRepository {
  private filePath: string;

  constructor(projectRoot?: string, filename = 'competitions.json') {
    const root = projectRoot || process.cwd();
    const dir = path.join(root, 'data', 'silver');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.filePath = path.join(dir, filename);

    // Seed initial competitions from registry if empty
    if (!fs.existsSync(this.filePath)) {
      this.writeAll(CompetitionRegistry.listAll());
    }
  }

  private readAll(): CanonicalCompetition[] {
    if (!fs.existsSync(this.filePath)) return [];
    try {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
    } catch {
      return [];
    }
  }

  private writeAll(competitions: CanonicalCompetition[]): void {
    fs.writeFileSync(this.filePath, JSON.stringify(competitions, null, 2), 'utf-8');
  }

  public async save(competition: CanonicalCompetition): Promise<void> {
    const list = this.readAll();
    const idx = list.findIndex(c => c.id === competition.id);
    if (idx !== -1) {
      list[idx] = competition;
    } else {
      list.push(competition);
    }
    this.writeAll(list);
  }

  public async findById(id: string): Promise<CanonicalCompetition | null> {
    const list = this.readAll();
    return list.find(c => c.id === id) || null;
  }

  public async listAll(): Promise<CanonicalCompetition[]> {
    return this.readAll();
  }
}
