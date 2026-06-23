export interface MockMatch {
  id: string;
  home_team: string;
  away_team: string;
  league: string;
  kickoff: string;
  status: string;
  home_goals?: number;
  away_goals?: number;
}

export interface MockPrediction {
  id: string;
  match_id: string;
  home_prob: number;
  draw_prob: number;
  away_prob: number;
  ah_line: number;
  ah_prob: number;
  ah_confidence: string;
  ou_line: number;
  over_prob: number;
  ou_confidence: string;
  expected_goals: number;
  confidence: string;
}

export const mockAccuracyStats = {
  total: 124,
  accuracy1x2: 68.55,
  accuracyAh: 61.29,
  accuracyOu: 57.26,
};

export const mockMatchesAndPredictions: { match: MockMatch; prediction: MockPrediction }[] = [
  {
    match: {
      id: 'm1',
      home_team: 'Manchester United',
      away_team: 'Fulham',
      league: 'Premier League',
      kickoff: new Date(Date.now() + 1000 * 60 * 60 * 2).toISOString(), // 2 hours from now
      status: 'upcoming',
    },
    prediction: {
      id: 'p1',
      match_id: 'm1',
      home_prob: 0.584,
      draw_prob: 0.221,
      away_prob: 0.195,
      ah_line: -0.75,
      ah_prob: 0.612,
      ah_confidence: '🟢 High',
      ou_line: 2.5,
      over_prob: 0.628,
      ou_confidence: '🟢 High',
      expected_goals: 2.85,
      confidence: '🟢 High',
    },
  },
  {
    match: {
      id: 'm2',
      home_team: 'Ipswich',
      away_team: 'Liverpool',
      league: 'Premier League',
      kickoff: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // 24 hours from now
      status: 'upcoming',
    },
    prediction: {
      id: 'p2',
      match_id: 'm2',
      home_prob: 0.155,
      draw_prob: 0.210,
      away_prob: 0.635,
      ah_line: -0.75,
      ah_prob: 0.384, // Home cover prob (Away is highly favored to cover -0.75)
      ah_confidence: '🟢 High',
      ou_line: 2.5,
      over_prob: 0.592,
      ou_confidence: '🟡 Medium',
      expected_goals: 3.12,
      confidence: '🟢 High',
    },
  },
  {
    match: {
      id: 'm3',
      home_team: 'Arsenal',
      away_team: 'Wolves',
      league: 'Premier League',
      kickoff: new Date(Date.now() + 1000 * 60 * 60 * 26).toISOString(),
      status: 'upcoming',
    },
    prediction: {
      id: 'p3',
      match_id: 'm3',
      home_prob: 0.724,
      draw_prob: 0.176,
      away_prob: 0.100,
      ah_line: -0.75,
      ah_prob: 0.748,
      ah_confidence: '🟢 High',
      ou_line: 2.5,
      over_prob: 0.684,
      ou_confidence: '🟢 High',
      expected_goals: 3.40,
      confidence: '🟢 High',
    },
  },
  {
    match: {
      id: 'm4',
      home_team: 'Chelsea',
      away_team: 'Manchester City',
      league: 'Premier League',
      kickoff: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
      status: 'upcoming',
    },
    prediction: {
      id: 'p4',
      match_id: 'm4',
      home_prob: 0.285,
      draw_prob: 0.245,
      away_prob: 0.470,
      ah_line: -0.75,
      ah_prob: 0.412,
      ah_confidence: '🟡 Medium',
      ou_line: 2.5,
      over_prob: 0.548,
      ou_confidence: '🟡 Medium',
      expected_goals: 2.90,
      confidence: '🟡 Medium',
    },
  },
  {
    match: {
      id: 'm5',
      home_team: 'Real Madrid',
      away_team: 'Barcelona',
      league: 'La Liga',
      kickoff: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString(),
      status: 'upcoming',
    },
    prediction: {
      id: 'p5',
      match_id: 'm5',
      home_prob: 0.485,
      draw_prob: 0.240,
      away_prob: 0.275,
      ah_line: -0.75,
      ah_prob: 0.528,
      ah_confidence: '🟡 Medium',
      ou_line: 2.5,
      over_prob: 0.612,
      ou_confidence: '🟢 High',
      expected_goals: 3.05,
      confidence: '🟢 High',
    },
  },
];
