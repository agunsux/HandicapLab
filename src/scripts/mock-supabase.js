const Module = require('module');
const originalLoad = Module._load;

const matchesMock = [
  { id: '11111111-1111-1111-1111-111111111111', home_team: 'Argentina', away_team: 'France', league: 'FIFA World Cup' },
  { id: '22222222-2222-2222-2222-222222222222', home_team: 'Brazil', away_team: 'Germany', league: 'FIFA World Cup' },
  { id: '33333333-3333-3333-3333-333333333333', home_team: 'Spain', away_team: 'England', league: 'FIFA World Cup' }
];

const predsMock = [
  { id: 'p1', match_id: '11111111-1111-1111-1111-111111111111', market_type: 'ML', model_probability: 0.65, edge_pct: 5.4, entry_odds: 1.95, fair_odds: 1.85 },
  { id: 'p2', match_id: '22222222-2222-2222-2222-222222222222', market_type: 'AH', model_probability: 0.58, edge_pct: 4.2, entry_odds: 1.85, fair_odds: 1.75 },
  { id: 'p3', match_id: '33333333-3333-3333-3333-333333333333', market_type: 'OU', model_probability: 0.61, edge_pct: 3.8, entry_odds: 2.10, fair_odds: 1.96 }
];

class QueryBuilder {
  constructor(table) {
    this.table = table;
    this.insertedData = null;
  }
  select() { return this; }
  ilike() { return this; }
  in() { return this; }
  gt() { return this; }
  gte() { return this; }
  order() { return this; }
  limit() { return this; }
  insert(data) {
    this.insertedData = data;
    return this;
  }
  then(onfulfilled) {
    let result = { data: null, error: null };
    if (this.table === 'matches') {
      result.data = matchesMock;
    } else if (this.table === 'predictions') {
      result.data = predsMock;
    } else if (this.table === 'auth.users') {
      result.data = [{ id: '00000000-0000-0000-0000-000000000001' }];
    } else if (this.table === 'paper_trades') {
      result.data = (Array.isArray(this.insertedData) ? this.insertedData : [this.insertedData]).map((t, idx) => ({
        ...t,
        id: `t-${idx}`,
        market_type: t.market_type || 'ML',
        selection: t.selection || 'home',
        edge_pct: 4.5
      }));
    }
    return Promise.resolve(result).then(onfulfilled);
  }
}

const mockedSupabaseClient = {
  from(table) {
    return new QueryBuilder(table);
  }
};

Module._load = function (request, parent, isMain) {
  if (request.includes('supabase.server') || request.includes('@/lib/supabase.server')) {
    return {
      supabase: mockedSupabaseClient
    };
  }
  return originalLoad.apply(this, arguments);
};
