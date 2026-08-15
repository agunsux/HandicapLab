// EPIC 40 — Hall of Fame & Hall of Shame Engine
// Manages Hall of Fame (Top Value Wins) and Hall of Shame (Worst Model Failures with mandatory root cause postmortems).

export interface HallItem {
  id: string;
  category: 'HALL_OF_FAME' | 'HALL_OF_SHAME';
  recordType: 'LARGEST_EDGE' | 'BEST_CLV' | 'BEST_LONG_ODDS' | 'WORST_PREDICTION' | 'LARGEST_CALIBRATION_ERROR';
  fixtureName: string;
  league: string;
  predictedProb: number;
  bookmakerOdds: number;
  expectedValue: number;
  result: 'WIN' | 'LOSS';
  postmortemNotes?: string;
  loggedAt: string;
}

export class HallEngine {
  private static RECORDS: HallItem[] = [];

  /** Get Hall of Fame records */
  static getHallOfFame(): HallItem[] {
    return this.RECORDS.filter(r => r.category === 'HALL_OF_FAME');
  }

  /** Get Hall of Shame records */
  static getHallOfShame(): HallItem[] {
    return this.RECORDS.filter(r => r.category === 'HALL_OF_SHAME');
  }

  /** Register an audited hall record */
  static registerRecord(item: HallItem): void {
    this.RECORDS.push(item);
  }
}
