// Stage A — Real-data query layer for Performance Ledger (Track Record).
// Wires to: performance_ledger table (created in EPIC 31A migration 31).

import { supabase } from '@/lib/supabase.server';

export interface TrackRecordData {
  seasonsAnalysed: number;
  verifiedBets: number;
  roi: number;
  yield: number;
  clv: number;
  lastUpdated: string;
  sampleSize: number;
  confidenceNote: string;
  isBacktest: boolean;
}

export async function fetchTrackRecord(): Promise<TrackRecordData> {
  try {
    const { data: ledgerRows, error } = await supabase
      .from('performance_ledger')
      .select('*')
      .order('computed_at', { ascending: false })
      .limit(1);

    if (error || !ledgerRows || ledgerRows.length === 0) {
      return insufficientData();
    }

    const latest = ledgerRows[0];
    const seasons = latest.model_version || '';
    const seasonCount = seasons.length > 0 ? Math.max(1, Math.round(Number(seasons) / 2)) : 1;

    return {
      seasonsAnalysed: seasonCount,
      verifiedBets: Number(latest.sample_size) || 0,
      roi: Number(latest.roi) || 0,
      yield: Number(latest.yield) || 0,
      clv: latest.clv ? Number(latest.clv) : 0,
      lastUpdated: latest.computed_at || new Date().toISOString(),
      sampleSize: Number(latest.sample_size) || 0,
      confidenceNote: latest.confidence_note || 'insufficient data',
      isBacktest: (latest.filter_label || '').toLowerCase().includes('backtest') || false,
    };
  } catch (err) {
    console.warn('[Performance Query] Failed:', err);
    return insufficientData();
  }
}

function insufficientData(): TrackRecordData {
  return {
    seasonsAnalysed: 0,
    verifiedBets: 0,
    roi: 0,
    yield: 0,
    clv: 0,
    lastUpdated: new Date().toISOString(),
    sampleSize: 0,
    confidenceNote: 'Insufficient sample — building track record',
    isBacktest: true,
  };
}
