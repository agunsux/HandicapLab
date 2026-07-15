import fs from 'fs';
import path from 'path';
import { TeamRepository } from '../../domain/dataset/repository';
import { CanonicalTeam } from '../../domain/dataset/canonical';
import { TeamRegistry } from '../registry/team-registry';

export class FileTeamRepository implements TeamRepository {
  private filePath: string;

  constructor(projectRoot?: string, filename = 'teams.json') {
    const root = projectRoot || process.cwd();
    const dir = path.join(root, 'data', 'silver');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    this.filePath = path.join(dir, filename);
    
    // Seed initial teams from the registry if repository is empty
    if (!fs.existsSync(this.filePath)) {
      this.writeAll(TeamRegistry.listAll());
    }
  }

  private readAll(): CanonicalTeam[] {
    if (!fs.existsSync(this.filePath)) return [];
    try {
      return JSON.parse(fs.readFileSync(this.filePath, 'utf-8'));
    } catch {
      return [];
    }
  }

  private writeAll(teams: CanonicalTeam[]): void {
    fs.writeFileSync(this.filePath, JSON.stringify(teams, null, 2), 'utf-8');
  }

  public async save(team: CanonicalTeam): Promise<void> {
    const list = this.readAll();
    const idx = list.findIndex(t => t.id === team.id);
    if (idx !== -1) {
      list[idx] = team;
    } else {
      list.push(team);
    }
    this.writeAll(list);
  }

  public async findById(id: string): Promise<CanonicalTeam | null> {
    const list = this.readAll();
    return list.find(t => t.id === id) || null;
  }

  public async findByNameOrAlias(name: string): Promise<CanonicalTeam | null> {
    const canonicalId = TeamRegistry.resolve(name);
    return this.findById(canonicalId);
  }

  public async listAll(): Promise<CanonicalTeam[]> {
    return this.readAll();
  }
}
