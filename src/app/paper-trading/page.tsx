import { supabase } from '@/lib/supabase.server';
import { PaperTradingDashboard } from './_components/PaperTradingDashboard';

export const revalidate = 0; // Disable static cache to ensure real-time model verification

export default async function PaperTradingPage() {
  // 1. Fetch paper trades
  const { data: trades, error } = await supabase
    .from('paper_trades')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch paper trades:', error);
  }

  // 2. Fetch matches to resolve team names
  const matchIds = Array.from(new Set((trades || []).map(t => t.match_id)));
  let matches: any[] = [];
  if (matchIds.length > 0) {
    const { data: matchesData } = await supabase
      .from('matches')
      .select('*')
      .in('id', matchIds);
    matches = matchesData || [];
  }

  // 3. Map items in memory
  const items = (trades || []).map(trade => {
    const match = matches.find(m => String(m.id) === String(trade.match_id) || String(m.external_match_id) === String(trade.match_id));
    return {
      id: trade.id,
      prediction_ledger_id: trade.prediction_ledger_id,
      match_id: trade.match_id,
      competition_id: trade.competition_id,
      market_type: trade.market_type,
      selection: trade.selection,
      entry_odds: trade.entry_odds,
      closing_odds: trade.closing_odds,
      stake_units: trade.stake_units,
      expected_value: trade.expected_value,
      edge_score: trade.edge_score,
      status: trade.status,
      pnl_units: trade.pnl_units,
      clv_percentage: trade.clv_percentage,
      created_at: trade.created_at,
      settled_at: trade.settled_at,
      home_team: match?.home_team || 'Unknown Home',
      away_team: match?.away_team || 'Unknown Away',
      kickoff: match?.kickoff || trade.created_at
    };
  });

  return (
    <main className="min-h-screen bg-[#050B13] text-[#E2E8F0] font-sans selection:bg-emerald-500 selection:text-slate-950">
      <PaperTradingDashboard initialTrades={items} />
    </main>
  );
}
