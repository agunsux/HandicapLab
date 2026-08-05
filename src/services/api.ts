import { Match, MatchOdds, Signal, MarketDepth, PerformanceStats } from '@/types';

// Mock Data Generators for robust fallback handling

export const MOCK_MATCHES: Match[] = [
  {
    id: 'm-101',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    league: 'Premier League',
    leagueSlug: 'english-premier-league',
    kickoff: new Date(Date.now() + 3600000).toISOString(),
    status: 'SCHEDULED',
  },
  {
    id: 'm-102',
    homeTeam: 'Real Madrid',
    awayTeam: 'Barcelona',
    league: 'La Liga',
    leagueSlug: 'la-liga',
    kickoff: new Date(Date.now() - 1800000).toISOString(),
    status: 'LIVE',
    minute: 34,
    homeScore: 1,
    awayScore: 0,
  },
  {
    id: 'm-103',
    homeTeam: 'Bayern Munich',
    awayTeam: 'Borussia Dortmund',
    league: 'Bundesliga',
    leagueSlug: 'bundesliga',
    kickoff: new Date(Date.now() - 4200000).toISOString(),
    status: 'IN_PLAY',
    minute: 78,
    homeScore: 2,
    awayScore: 2,
  },
  {
    id: 'm-104',
    homeTeam: 'Inter Milan',
    awayTeam: 'AC Milan',
    league: 'Serie A',
    leagueSlug: 'serie-a',
    kickoff: new Date(Date.now() + 86400000).toISOString(),
    status: 'SCHEDULED',
  },
  {
    id: 'm-105',
    homeTeam: 'Paris Saint-Germain',
    awayTeam: 'Marseille',
    league: 'Ligue 1',
    leagueSlug: 'ligue-1',
    kickoff: new Date(Date.now() + 172800000).toISOString(),
    status: 'SCHEDULED',
  },
  {
    id: 'm-106',
    homeTeam: 'Liverpool',
    awayTeam: 'Manchester City',
    league: 'Premier League',
    leagueSlug: 'english-premier-league',
    kickoff: new Date(Date.now() + 259200000).toISOString(),
    status: 'SCHEDULED',
  },
];

export const MOCK_SIGNALS: Signal[] = [
  {
    id: 'sig-1',
    matchId: 'm-101',
    homeTeam: 'Arsenal',
    awayTeam: 'Chelsea',
    league: 'Premier League',
    kickoff: new Date(Date.now() + 3600000).toISOString(),
    marketType: 'AH',
    selection: 'Arsenal -0.75',
    bookmaker: 'Pinnacle',
    odds: 1.95,
    fairOdds: 1.78,
    ev: 9.55,
    confidence: 84,
    sharpMoney: 88,
    expiryTime: '45m',
    reason: 'Pinnacle line moved 0.15 points sharper than market consensus. xG projections favor Arsenal by +1.12 goals.',
    publicMoneyPercent: 32,
    isHighValue: true,
    signalCategory: 'Sharp',
  },
  {
    id: 'sig-2',
    matchId: 'm-102',
    homeTeam: 'Real Madrid',
    awayTeam: 'Barcelona',
    league: 'La Liga',
    kickoff: new Date(Date.now() - 1800000).toISOString(),
    marketType: 'OU',
    selection: 'Over 2.75',
    bookmaker: 'Pinnacle',
    odds: 2.04,
    fairOdds: 1.89,
    ev: 7.93,
    confidence: 76,
    sharpMoney: 72,
    expiryTime: 'LIVE',
    reason: 'High total xG trend in last 5 H2H encounters (avg 3.4 xG). Live momentum metrics spiking.',
    publicMoneyPercent: 48,
    isHighValue: false,
    signalCategory: 'Steam',
  },
  {
    id: 'sig-3',
    matchId: 'm-103',
    homeTeam: 'Bayern Munich',
    awayTeam: 'Borussia Dortmund',
    league: 'Bundesliga',
    kickoff: new Date(Date.now() - 4200000).toISOString(),
    marketType: 'BTTS',
    selection: 'Both Teams To Score - Yes',
    bookmaker: 'SBOBET',
    odds: 1.82,
    fairOdds: 1.68,
    ev: 8.33,
    confidence: 81,
    sharpMoney: 91,
    expiryTime: 'LIVE',
    reason: 'Defensive injuries on both squads. Dixon-Coles model predicts 82% joint scoring likelihood.',
    publicMoneyPercent: 65,
    isHighValue: true,
    signalCategory: 'Value',
  },
  {
    id: 'sig-4',
    matchId: 'm-104',
    homeTeam: 'Inter Milan',
    awayTeam: 'AC Milan',
    league: 'Serie A',
    kickoff: new Date(Date.now() + 86400000).toISOString(),
    marketType: 'ML',
    selection: 'Inter Milan',
    bookmaker: 'Pinnacle',
    odds: 2.15,
    fairOdds: 2.01,
    ev: 6.96,
    confidence: 71,
    sharpMoney: 64,
    expiryTime: '23h',
    reason: 'Home pitch advantage coefficient + Elo rating differential (+95 Elo points).',
    publicMoneyPercent: 42,
    isHighValue: false,
    signalCategory: 'Reverse Line',
  },
  {
    id: 'sig-5',
    matchId: 'm-105',
    homeTeam: 'Paris Saint-Germain',
    awayTeam: 'Marseille',
    league: 'Ligue 1',
    kickoff: new Date(Date.now() + 172800000).toISOString(),
    marketType: 'AH',
    selection: 'PSG -1.25',
    bookmaker: 'Pinnacle',
    odds: 1.98,
    fairOdds: 1.80,
    ev: 10.0,
    confidence: 89,
    sharpMoney: 94,
    expiryTime: '47h',
    reason: 'Massive sharp money inflow detected across Asian bookies. Opening line drifted 8% above model fair value.',
    publicMoneyPercent: 28,
    isHighValue: true,
    signalCategory: 'Sharp',
  },
];

export async function fetchMatches(dateFrom?: string, dateTo?: string): Promise<Match[]> {
  try {
    const apiKey = process.env.NEXT_PUBLIC_FOOTBALL_DATA_API_KEY || process.env.VITE_FOOTBALL_DATA_API_KEY;
    if (apiKey) {
      const res = await fetch(`https://api.football-data.org/v4/matches?dateFrom=${dateFrom || ''}&dateTo=${dateTo || ''}`, {
        headers: { 'X-Auth-Token': apiKey },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.matches && data.matches.length > 0) {
          return data.matches.map((m: any) => ({
            id: String(m.id),
            homeTeam: m.homeTeam.name,
            awayTeam: m.awayTeam.name,
            league: m.competition.name,
            kickoff: m.utcDate,
            status: m.status === 'IN_PLAY' || m.status === 'PAUSED' ? 'LIVE' : m.status,
            homeScore: m.score?.fullTime?.home ?? m.score?.halfTime?.home,
            awayScore: m.score?.fullTime?.away ?? m.score?.halfTime?.away,
          }));
        }
      }
    }
  } catch {}
  return MOCK_MATCHES;
}

export async function fetchLiveMatches(): Promise<Match[]> {
  const matches = await fetchMatches();
  return matches.filter((m) => m.status === 'LIVE' || m.status === 'IN_PLAY');
}

export async function fetchOdds(matchId?: string): Promise<MatchOdds[]> {
  const match = MOCK_MATCHES.find((m) => m.id === matchId) || MOCK_MATCHES[0];
  return [
    {
      matchId: match.id,
      market: 'AH',
      items: [
        { bookmaker: 'Pinnacle', selection: `${match.homeTeam} -0.5`, price: 1.95, previousPrice: 1.88, changePercent: 3.7 },
        { bookmaker: 'SBOBET', selection: `${match.awayTeam} +0.5`, price: 1.93, previousPrice: 1.98, changePercent: -2.5 },
        { bookmaker: '188Bet', selection: `${match.homeTeam} -0.5`, price: 1.91, previousPrice: 1.91, changePercent: 0 },
        { bookmaker: 'Bet365', selection: `${match.awayTeam} +0.5`, price: 1.89, previousPrice: 1.92, changePercent: -1.5 },
      ],
    },
    {
      matchId: match.id,
      market: 'OU',
      items: [
        { bookmaker: 'Pinnacle', selection: 'Over 2.5', price: 2.02, previousPrice: 1.95, changePercent: 3.5 },
        { bookmaker: 'SBOBET', selection: 'Under 2.5', price: 1.86, previousPrice: 1.90, changePercent: -2.1 },
        { bookmaker: 'Dafabet', selection: 'Over 2.5', price: 1.98, previousPrice: 1.98, changePercent: 0 },
      ],
    },
    {
      matchId: match.id,
      market: 'ML',
      items: [
        { bookmaker: 'Pinnacle', selection: match.homeTeam, price: 2.10, previousPrice: 2.05, changePercent: 2.4 },
        { bookmaker: 'Pinnacle', selection: 'Draw', price: 3.40, previousPrice: 3.40, changePercent: 0 },
        { bookmaker: 'Pinnacle', selection: match.awayTeam, price: 3.50, previousPrice: 3.65, changePercent: -4.1 },
      ],
    },
  ];
}

export async function fetchSignals(filters?: { market?: string; minEv?: number }): Promise<Signal[]> {
  try {
    const res = await fetch('/api/v1/signals');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        return data.map((s: any) => ({
          id: s.id,
          matchId: s.match_id || s.id,
          homeTeam: s.home_team || 'Home',
          awayTeam: s.away_team || 'Away',
          league: s.league || 'Top League',
          kickoff: s.kickoff || s.prediction_timestamp || new Date().toISOString(),
          marketType: s.market_type || 'AH',
          selection: s.selection || 'Home Win',
          bookmaker: 'Pinnacle',
          odds: s.entry_odds || s.odds || 2.0,
          fairOdds: s.fair_odds || 1.85,
          ev: s.expected_value ? s.expected_value * 100 : 7.5,
          confidence: Math.round((s.model_probability || 0.6) * 100),
          sharpMoney: 85,
          expiryTime: '12h',
          reason: s.explainability_json?.summary || 'Quantitative model edge over Pinnacle closing line.',
          publicMoneyPercent: 35,
          isHighValue: (s.expected_value || 0.08) > 0.08,
          signalCategory: 'Value',
        }));
      }
    }
  } catch {}
  return MOCK_SIGNALS;
}

export async function fetchSignalDetails(signalId: string): Promise<Signal | null> {
  const signals = await fetchSignals();
  return signals.find((s) => s.id === signalId) || signals[0] || null;
}

export async function fetchMarketDepth(matchId: string, market: string): Promise<MarketDepth> {
  return {
    matchId,
    market: (market as any) || 'AH',
    bestOdds: 2.08,
    volumeWeightedOdds: 1.97,
    liquidityScore: 92,
    bookmakersCount: 18,
  };
}

export async function fetchPerformance(days: number = 30): Promise<PerformanceStats> {
  const dates = Array.from({ length: days }).map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return d.toISOString().split('T')[0];
  });

  let cum = 0;
  const history = dates.map((date) => {
    const pnl = Number((Math.random() * 2.2 - 0.7).toFixed(2));
    cum += pnl;
    return { date, pnl, cumulative: Number(cum.toFixed(2)) };
  });

  return {
    days,
    totalBets: days * 3,
    winRate: 59.2,
    cumulativePnL: Number(cum.toFixed(2)),
    roi: 13.4,
    dailyHistory: history,
  };
}
