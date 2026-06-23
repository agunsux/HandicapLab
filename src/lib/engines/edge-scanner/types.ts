export interface MarketOdds {
  homeOdds?: number; // home win (ML), home cover (AH), Over (OU)
  awayOdds?: number; // away win (ML), away cover (AH), Under (OU)
  drawOdds?: number; // Draw (ML only)
  line?: number;     // Handicap or total line (AH/OU)
}

export interface EdgePick {
  matchId: string;
  marketType: 'ML' | 'AH' | 'OU';
  line: string;             // e.g. "0.0", "-0.5", "2.5", "1X2"
  outcome: 'home' | 'draw' | 'away' | 'over' | 'under';
  modelProbability: number;
  marketOdds: number;
  impliedProbability: number;
  expectedValue: number;    // (modelProbability * marketOdds) - 1
  kellyStake: number;       // fractional Kelly stake
  clv: number | null;       // Closing Line Value
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
  tier: 'FREE' | 'PRO' | 'ELITE';
}
