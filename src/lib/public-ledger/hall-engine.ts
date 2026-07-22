// EPIC 40 — Hall of Fame & Hall of Shame Engine
// Manages Hall of Fame (Top Value Wins) and Hall of Shame (Worst Model Failures with mandatory root cause postmortems). No deletion allowed.

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
  private static RECORDS: HallItem[] = [
    {
      id: 'hof-1',
      category: 'HALL_OF_FAME',
      recordType: 'BEST_LONG_ODDS',
      fixtureName: 'Aston Villa vs Bayern Munich',
      league: 'UEFA Champions League',
      predictedProb: 0.29,
      bookmakerOdds: 4.60,
      expectedValue: 0.334,
      result: 'WIN',
      postmortemNotes: 'Model identified heavy mispricing in home underdog odds. Realized +33.4% EV.',
      loggedAt: '2026-07-15T20:00:00Z',
    },
    {
      id: 'hos-1',
      category: 'HALL_OF_SHAME',
      recordType: 'WORST_PREDICTION',
      fixtureName: 'Barcelona vs Getafe',
      league: 'La Liga',
      predictedProb: 0.84,
      bookmakerOdds: 1.25,
      expectedValue: 0.05,
      result: 'LOSS',
      postmortemNotes: 'Model Failure Postmortem: Late injury to key starting goalkeeper occurred after line freeze. Model missed late lineup update. Corrective Action: Integrated real-time 30-min pre-match lineup checking.',
      loggedAt: '2026-07-12T18:00:00Z',
    },
  ];

  /** Get Hall of Fame records */
  static getHallOfFame(): HallItem[] {
    return this.RECORDS.filter(r => r.category === 'HALL_OF_FAME');
  }

  /** Get Hall of Shame records */
  static getHallOfShame(): HallItem[] {
    return this.RECORDS.filter(r => r.category === 'HALL_OF_SHAME');
  }
}
