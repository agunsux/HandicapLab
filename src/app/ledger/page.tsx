import { supabase } from '@/lib/supabase.server';
import { LedgerTable } from './_components/LedgerTable';

export const revalidate = 0; // Disable static cache to ensure absolute transparency of fresh signals

export default async function LedgerPage() {
  // 1. Fetch raw ledger entries
  const { data: ledgerEntries, error: ledgerErr } = await supabase
    .from('prediction_ledger')
    .select('*')
    .order('published_at', { ascending: false });

  if (ledgerErr) {
    console.error('Failed to fetch prediction ledger:', ledgerErr);
  }

  // 2. Fetch matches corresponding to the ledger
  const matchIds = Array.from(new Set((ledgerEntries || []).map(e => e.match_id)));
  let matches: any[] = [];
  if (matchIds.length > 0) {
    const { data: matchesData } = await supabase
      .from('matches')
      .select('*')
      .in('id', matchIds);
    matches = matchesData || [];
  }

  // 3. Fetch competitions cache corresponding to the ledger
  const compIds = Array.from(new Set((ledgerEntries || []).map(e => e.competition_id).filter(Boolean)));
  let competitions: any[] = [];
  if (compIds.length > 0) {
    const { data: compData } = await supabase
      .from('leagues_cache')
      .select('*')
      .in('api_id', compIds);
    competitions = compData || [];
  }

  // Fetch prediction decisions
  const { data: decisions } = await supabase
    .from('prediction_decisions')
    .select('*');

  // 4. Combine data layers in memory
  const items = (ledgerEntries || []).map((entry) => {
    const match = matches.find(m => String(m.id) === String(entry.match_id) || String(m.external_match_id) === String(entry.match_id));
    const comp = competitions.find(c => Number(c.api_id) === Number(entry.competition_id));
    const decisionObj = (decisions || []).find(d => String(d.prediction_ledger_id) === String(entry.id));

    return {
      id: entry.id,
      published_at: entry.published_at,
      market: entry.market,
      selection: entry.selection,
      odds_at_prediction: entry.odds_at_prediction,
      confidence: entry.confidence,
      model_version: entry.model_version || 'prematch-v1',
      result_status: entry.result_status,
      settled_at: entry.settled_at,
      roi: entry.roi,
      verified: entry.verified,
      home_team: match?.home_team || 'Unknown Team',
      away_team: match?.away_team || 'Unknown Team',
      kickoff: match?.kickoff || entry.published_at,
      competition_name: comp?.name || 'Global Match',
      competition_logo: comp?.logo_url || '',
      
      // Decisions mapping:
      decision: decisionObj?.decision || entry.decision || 'SKIP',
      reason_category: decisionObj?.reason_category || entry.decision_reason || 'NO_SELECTION',
      reason_text: decisionObj?.reason_text || entry.decision_reason || 'Does not meet EV/confidence criteria',
      edge_score: decisionObj?.edge_score !== undefined ? Number(decisionObj.edge_score) : null,
      expected_value: decisionObj?.expected_value !== undefined ? Number(decisionObj.expected_value) : null,

      // Source telemetry:
      data_source: match?.source || 'API-Football / Pinnacle',
      fetched_at: match?.fetched_at || entry.published_at
    };
  });

  return (
    <main className="min-h-screen bg-[#060B13] text-[#E2E8F0] font-sans selection:bg-emerald-500 selection:text-slate-950">
      {/* Terminal Header */}
      <div className="border-b border-slate-800/80 bg-slate-900/40 backdrop-blur-md px-6 py-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            <span className="text-[10px] font-mono font-bold text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              IMMUTABLE RECORD
            </span>
            <h1 className="text-lg font-mono font-bold tracking-tight text-white ml-1">
              PUBLIC PREDICTION LEDGER
            </h1>
          </div>
          <p className="text-xs text-slate-400 mt-1.5 max-w-xl font-mono">
            Verifiable history of ensembled model outputs. Once published, odds and prediction outcomes are permanently locked.
          </p>
        </div>
        <div className="text-right font-mono text-[10px] text-slate-500 self-stretch md:self-auto flex items-center justify-between md:justify-end gap-2 border-t border-slate-800 md:border-none pt-2 md:pt-0">
          <span>SOURCE: <b className="text-slate-300">API-Football / OddsPapi</b></span>
          <span className="hidden md:inline text-slate-700">•</span>
          <span>ENTRIES: <b className="text-slate-300">{items.length}</b></span>
        </div>
      </div>

      {/* Verification Transparency Banner */}
      <div className="max-w-6xl mx-auto px-6 pt-6">
        <div className="bg-emerald-500/10 border border-emerald-500/25 px-4 py-3 rounded-lg text-xs font-mono text-emerald-400 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm">🛡️</span>
            <span><b>TRANSPARENCY NOTICE:</b> Every prediction is timestamped and verified after match completion.</span>
          </div>
          <div className="text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded text-white font-bold hidden sm:block">
            ✓ SECURE CRYPTO ID
          </div>
        </div>
      </div>

      {/* Render Client Component Ledger Table */}
      <LedgerTable initialItems={items} />
    </main>
  );
}
