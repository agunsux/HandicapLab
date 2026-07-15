// DB persistence for the Settlement Core (Epic 31A).
// Writes are INSERT-ONLY into the existing append-only tables (odds_snapshots,
// provider_logs) plus the new performance_ledger table. No existing row is ever
// updated or deleted. This EXTENDS the live pipeline; it never rewrites it.

import crypto from 'crypto';
import { query } from '@/lib/db/connection';
import type { OddsTick } from './types';
import type { OddsWriter, ProviderLogEntry } from './odds-ingestion';
import type { PerformanceLedgerRow } from './types';

function priceColumns(tick: OddsTick): {
  price_home: number | null;
  price_away: number | null;
  price_draw: number | null;
} {
  const home = tick.selection === 'home' || tick.selection === 'over' ? tick.odds : null;
  const away = tick.selection === 'away' || tick.selection === 'under' ? tick.odds : null;
  const draw = tick.selection === 'draw' ? tick.odds : null;
  return { price_home: home, price_away: away, price_draw: draw };
}

export const dbOddsWriter: OddsWriter = {
  async writeTicks(ticks: OddsTick[]): Promise<void> {
    for (const tick of ticks) {
      const { price_home, price_away, price_draw } = priceColumns(tick);
      const captured = new Date(tick.capturedAt).toISOString();
      const payload = JSON.stringify({
        fixture_id: tick.fixtureId,
        provider: tick.provider,
        market: tick.market,
        line: tick.line,
        selection: tick.selection,
        odds: tick.odds,
        captured,
      });
      const chainHash = crypto.createHash('sha256').update(payload).digest('hex');
      await query(
        `INSERT INTO odds_snapshots
           (fixture_id, bookmaker, market_type, line, price_home, price_away, price_draw,
            captured_at, chain_hash, provider, provider_latency_ms, raw_payload_id)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
        [
          tick.fixtureId,
          tick.provider,
          tick.market,
          tick.line,
          price_home,
          price_away,
          price_draw,
          captured,
          chainHash,
          tick.provider,
          tick.providerLatencyMs ?? null,
          tick.rawPayloadId ?? null,
        ]
      );
    }
  },

  async logProvider(entry: ProviderLogEntry): Promise<void> {
    await query(
      `INSERT INTO provider_logs
         (provider, endpoint, method, status_code, duration_ms, level, message, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        entry.provider,
        entry.endpoint,
        entry.method,
        entry.statusCode,
        entry.durationMs,
        entry.level,
        entry.message,
        entry.metadata ? JSON.stringify(entry.metadata) : null,
      ]
    );
  },
};

export async function persistPerformanceLedger(
  row: PerformanceLedgerRow,
  modelVersion: string,
  filterLabel: string
): Promise<void> {
  await query(
    `INSERT INTO performance_ledger
       (model_version, filter_label, roi, yield, clv, profit_loss_units, avg_odds,
        avg_edge, strike_rate, max_drawdown, sample_size, date_range_start,
        date_range_end, confidence_note)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [
      modelVersion,
      filterLabel,
      row.roi,
      row.yield,
      row.clv,
      row.profitLossUnits,
      row.avgOdds,
      row.avgEdge,
      row.strikeRate,
      row.maxDrawdown,
      row.sampleSize,
      row.dateRange.start || null,
      row.dateRange.end || null,
      row.confidenceNote,
    ]
  );
}
