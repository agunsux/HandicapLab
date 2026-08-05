import {
  Match,
  MatchOdds,
  Signal,
  MarketDepth,
  PerformanceStats,
  MarketType,
  SignalType,
} from '@/types';

// Deterministic PRNG based on string seed
function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash) || 123456789;
}

function createSeededRandom(seedStr: string) {
  let seed = simpleHash(seedStr);
  return function random() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

export const TEAMS_DATA = [
  { home: 'Man City', away: 'Liverpool', league: 'Premier League', country: 'England' },
  { home: 'Real Madrid', away: 'Barcelona', league: 'La Liga', country: 'Spain' },
  { home: 'Bayern Munich', away: 'Borussia Dortmund', league: 'Bundesliga', country: 'Germany' },
  { home: 'Juventus', away: 'Inter Milan', league: 'Serie A', country: 'Italy' },
  { home: 'PSG', away: 'Marseille', league: 'Ligue 1', country: 'France' },
  { home: 'Ajax', away: 'PSV Eindhoven', league: 'Eredivisie', country: 'Netherlands' },
  { home: 'Arsenal', away: 'Chelsea', league: 'Premier League', country: 'England' },
  { home: 'Atletico Madrid', away: 'Sevilla', league: 'La Liga', country: 'Spain' },
  { home: 'AC Milan', away: 'Napoli', league: 'Serie A', country: 'Italy' },
  { home: 'Leverkusen', away: 'RB Leipzig', league: 'Bundesliga', country: 'Germany' },
  { home: 'Lyon', away: 'Monaco', league: 'Ligue 1', country: 'France' },
  { home: 'Tottenham', away: 'Manchester United', league: 'Premier League', country: 'England' },
];

/**
 * Generate deterministic mock matches
 */
export function generateMockMatches(count: number = 12, dateKey: string = 'today'): Match[] {
  const rng = createSeededRandom(`matches-${dateKey}`);
  const baseTime = new Date('2026-08-06T12:00:00Z').getTime();

  return TEAMS_DATA.slice(0, count).map((t, idx) => {
    const r = rng();
    const isLive = idx === 1 || idx === 3;
    const isFinished = idx === 5;
    const status = isLive ? 'LIVE' : isFinished ? 'FINISHED' : 'SCHEDULED';
    
    // Deterministic scores
    const homeGoals = Math.floor(r * 3);
    const awayGoals = Math.floor((r * 7) % 3);

    return {
      id: `m-${101 + idx}`,
      homeTeam: t.home,
      awayTeam: t.away,
      league: t.league,
      country: t.country,
      kickoff: new Date(baseTime + (idx - 2) * 3600000 * 4).toISOString(),
      status,
      minute: isLive ? 32 + Math.floor(r * 40) : undefined,
      score: isLive || isFinished ? { home: homeGoals, away: awayGoals } : undefined,
    };
  });
}

/**
 * Generate deterministic mock odds with tick micro-variations for live simulation
 */
export function generateMockOdds(matchId: string = 'm-101', tick: number = 0): MatchOdds[] {
  const rng = createSeededRandom(`odds-${matchId}`);
  const bookies = ['Pinnacle', 'Bet365', 'Betfair', 'SBOBet', 'MaxBet', '188Bet'];
  const markets: MarketType[] = ['asian_handicap', 'over_under', 'moneyline', 'btts'];
  const result: MatchOdds[] = [];

  markets.forEach((market) => {
    bookies.forEach((b) => {
      const r = rng();
      // Base odds generated deterministically
      let baseOdds = Number((1.70 + r * 1.5).toFixed(2));
      
      // Tick-based micro movement (-0.03 to +0.03) to simulate live updates without complete jumps
      const tickDelta = Number((Math.sin(tick * 0.5 + r * 10) * 0.03).toFixed(2));
      const odds = Math.max(1.05, Number((baseOdds + tickDelta).toFixed(2)));
      const change = Number(((tickDelta / baseOdds) * 100).toFixed(1));

      result.push({
        matchId,
        bookmaker: b,
        market,
        selection:
          market === 'moneyline'
            ? 'Home Win'
            : market === 'over_under'
            ? 'Over 2.5'
            : market === 'btts'
            ? 'BTTS Yes'
            : 'Home -0.5',
        odds,
        line: market === 'asian_handicap' ? -0.5 : market === 'over_under' ? 2.5 : undefined,
        volume: Math.floor(r * 50000 + 5000),
        timestamp: new Date().toISOString(),
        previousOdds: baseOdds,
        changePercent: change,
      });
    });
  });

  return result;
}

/**
 * Generate deterministic mock signals
 */
export function generateMockSignals(count: number = 10, dateKey: string = 'today'): Signal[] {
  const rng = createSeededRandom(`signals-${dateKey}`);
  const matches = generateMockMatches(count, dateKey);
  const signalTypes: SignalType[] = ['value', 'steam', 'drift', 'reverse_line', 'sharp'];
  const markets: MarketType[] = ['asian_handicap', 'over_under', 'moneyline', 'btts'];
  const bookies = ['Pinnacle', 'SBOBet', 'Bet365', 'Betfair'];

  return matches.map((m, idx) => {
    const r = rng();
    const market = markets[idx % markets.length];
    const type = signalTypes[idx % signalTypes.length];
    const odds = Number((1.85 + (r * 0.6)).toFixed(2));
    const fairOdds = Number((odds * 0.90).toFixed(2));
    const ev = Number(((1 / fairOdds - 1 / odds) * 100 * 1.8).toFixed(1));
    const confidence = Math.floor(65 + r * 28);

    return {
      id: `sig-${101 + idx}`,
      matchId: m.id,
      type,
      market,
      selection: `${m.homeTeam} ${
        market === 'asian_handicap' ? '-0.75' : market === 'over_under' ? 'Over 2.5' : 'Win'
      }`,
      confidence,
      ev,
      odds,
      fairOdds,
      edge: Number((ev * 0.85).toFixed(1)),
      bookmaker: bookies[idx % bookies.length],
      timestamp: new Date().toISOString(),
      expiresAt: '2h 15m',
      reason: `Sharp volume surge detected on ${bookies[idx % bookies.length]} line. Model projected fair odds at ${fairOdds.toFixed(2)} vs market price ${odds.toFixed(2)}.`,
      sharpMoneyIndicator: Math.floor(70 + r * 25),
      lineMovement: type === 'steam' ? 'steam' : type === 'drift' ? 'drift' : 'stable',
      publicMoneyPercent: Math.floor(30 + r * 40),
      homeTeam: m.homeTeam,
      awayTeam: m.awayTeam,
      league: m.league,
      kickoff: m.kickoff,
      marketType:
        market === 'asian_handicap' ? 'AH' : market === 'over_under' ? 'OU' : market === 'moneyline' ? 'ML' : 'BTTS',
      signalCategory: type.toUpperCase().replace('_', ' '),
      isHighValue: ev > 8.0,
    };
  });
}

/**
 * Generate deterministic performance stats
 */
export function generateMockPerformance(days: number = 30): PerformanceStats[] {
  const rng = createSeededRandom(`perf-${days}`);
  let cum = 0;
  return Array.from({ length: days }).map((_, idx) => {
    const r = rng();
    const date = new Date(Date.now() - (days - 1 - idx) * 86400000).toISOString().split('T')[0];
    const profit = Number(((r - 0.42) * 4.2).toFixed(2));
    cum += profit;
    return {
      date,
      profit,
      cumulative: Number(cum.toFixed(2)),
      bets: Math.floor(r * 6 + 1),
      winRate: Number((52 + r * 14).toFixed(1)),
    };
  });
}

/**
 * Generate mock match xG & stats
 */
export function generateMockMatchStats(fixtureId: string | number) {
  const rng = createSeededRandom(`stats-${fixtureId}`);
  const r = rng();
  return {
    fixtureId,
    xG: {
      home: Number((1.2 + r * 1.5).toFixed(2)),
      away: Number((0.6 + r * 1.1).toFixed(2)),
    },
    possession: {
      home: Math.floor(45 + r * 20),
      away: Math.floor(55 - r * 20),
    },
    shotsOnTarget: {
      home: Math.floor(3 + r * 6),
      away: Math.floor(2 + r * 5),
    },
    dangerousAttacks: {
      home: Math.floor(40 + r * 30),
      away: Math.floor(35 + r * 25),
    },
  };
}

/**
 * Generate mock predictions
 */
export function generateMockPredictions(fixtureId: string | number) {
  const rng = createSeededRandom(`pred-${fixtureId}`);
  const r = rng();
  const homeProb = Math.floor(45 + r * 25);
  const drawProb = Math.floor(20 + r * 10);
  const awayProb = 100 - homeProb - drawProb;

  return {
    fixtureId,
    advice: homeProb > 50 ? 'Combo Double Chance: Home or Draw' : 'Value Pick: Away Asian Handicap +0.5',
    percent: {
      home: `${homeProb}%`,
      draw: `${drawProb}%`,
      away: `${awayProb}%`,
    },
    winOrDraw: homeProb > 40,
    underOver: r > 0.5 ? 'Over 2.5' : 'Under 2.5',
    goals: {
      home: Number((1.5 + r * 0.8).toFixed(1)),
      away: Number((0.9 + r * 0.6).toFixed(1)),
    },
  };
}

/**
 * Generate mock market depth
 */
export function generateMockMarketDepth(matchId: string, market: MarketType): MarketDepth {
  const rng = createSeededRandom(`depth-${matchId}-${market}`);
  const r = rng();
  return {
    matchId,
    market,
    selections: [
      {
        name: market === 'moneyline' ? 'Home Win' : 'Selection A',
        bestOdds: Number((1.95 + r * 0.3).toFixed(2)),
        bookmaker: 'Pinnacle',
        volumeWeightedOdds: Number((1.92 + r * 0.28).toFixed(2)),
        liquidityScore: Math.floor(88 + r * 10),
      },
      {
        name: market === 'moneyline' ? 'Draw' : 'Selection B',
        bestOdds: Number((3.30 + r * 0.4).toFixed(2)),
        bookmaker: 'Bet365',
        volumeWeightedOdds: Number((3.25 + r * 0.35).toFixed(2)),
        liquidityScore: Math.floor(80 + r * 12),
      },
      {
        name: market === 'moneyline' ? 'Away Win' : 'Selection C',
        bestOdds: Number((3.50 + r * 0.5).toFixed(2)),
        bookmaker: 'SBOBet',
        volumeWeightedOdds: Number((3.42 + r * 0.45).toFixed(2)),
        liquidityScore: Math.floor(84 + r * 10),
      },
    ],
  };
}
