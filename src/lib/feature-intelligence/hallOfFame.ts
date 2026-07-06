// HandicapLab Feature Intelligence - Hall of Fame & Graveyard
import * as fs from 'fs';
import * as path from 'path';

export interface HallOfFameEntry {
  featureId: string;
  promotedAt: string;
  performanceMetrics: any;
  passedLeagues: string[];
}

export interface GraveyardEntry {
  featureId: string;
  discardedAt: string;
  reason: string;
  lastExperiment: string;
}

export class RegistryManager {
  private static readonly PATH_HOF = path.join(process.cwd(), 'research', 'feature_hall_of_fame');
  private static readonly PATH_GRAVE = path.join(process.cwd(), 'research', 'feature_graveyard');

  public static init() {
    if (!fs.existsSync(this.PATH_HOF)) fs.mkdirSync(this.PATH_HOF, { recursive: true });
    if (!fs.existsSync(this.PATH_GRAVE)) fs.mkdirSync(this.PATH_GRAVE, { recursive: true });
  }

  public static promoteToHallOfFame(entry: HallOfFameEntry): void {
    this.init();
    fs.writeFileSync(
      path.join(this.PATH_HOF, `${entry.featureId}.json`),
      JSON.stringify(entry, null, 2)
    );
  }

  public static sendToGraveyard(entry: GraveyardEntry): void {
    this.init();
    fs.writeFileSync(
      path.join(this.PATH_GRAVE, `${entry.featureId}.json`),
      JSON.stringify(entry, null, 2)
    );
  }
}
