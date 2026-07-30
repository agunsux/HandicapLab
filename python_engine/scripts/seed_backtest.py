"""
scripts/seed_backtest.py — Main entry for historical backtest seeder.

Modes:
  --dry-run      Compute everything, print report, write to output JSON. NO Supabase.
  --output-json  Same as dry-run, writes clean picks JSON for manual review. NO Supabase.
  --seed         REQUIRES real Supabase credentials. Fail-fast if missing.

Default (no flag) = --dry-run.

ZERO API CALLS — reads only local CSVs from football-data.co.uk.
"""
import sys
import os
import json
import argparse
from datetime import datetime

# Ensure python_engine is on path
ENGINE_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ENGINE_ROOT)

from data.historical.downloader import download_all
from data.historical.parser import parse_all
from engine.backtester import run_backtest
from engine.metrics import (
    compute_summary,
    distribution_sanity_check,
    win_rate as calc_win_rate,
    roi as calc_roi,
)

OUTPUT_DIR = os.path.join(ENGINE_ROOT, "data", "historical", "output")


def print_report(summary: dict, sanity: dict, coverage: dict, picks: list):
    """Print formatted dry-run report."""
    print("\n")
    print("=" * 70)
    print("  HANDICAPLAB — HISTORICAL BACKTEST REPORT")
    print("  Walk-Forward | Dixon-Coles MLE | Zero API Calls")
    print("=" * 70)

    print(f"\n  COVERAGE")
    print(f"    Files downloaded: {coverage['downloaded']}/{coverage['total']}")
    if coverage.get('skipped'):
        for s in coverage['skipped']:
            print(f"    SKIPPED: {s['league']} {s['season']} — {s['reason']}")
    print(f"    Total matches parsed: {coverage.get('total_matches', 'N/A')}")

    print(f"\n  PICK SUMMARY")
    print(f"    Total picks:      {summary['total_picks']}")
    print(f"    Win rate:         {summary['win_rate']*100:.2f}%")
    print(f"    ROI:              {summary['roi']:+.2f}%")
    print(f"    Cumulative P&L:   {summary['cumulative_profit']:+.2f} units")
    print(f"    Max drawdown:     {summary['max_drawdown']:.2f} units")

    print(f"\n  BRIER SCORES (baseline 0.25 — lower is better)")
    print(f"    Overall:  {summary['brier_overall']:.4f}  {'[OK]' if summary['brier_overall'] < 0.25 else '[FAIL] WARNING'}")
    print(f"    ML:       {summary['brier_ml']:.4f}")
    print(f"    O/U:      {summary['brier_ou']:.4f}")
    print(f"    AH:       {summary['brier_ah']:.4f}")

    print(f"\n  CLV (Closing Line Value)")
    print(f"    Avg CLV:  {summary['avg_clv']:+.2f}%  {'[OK] beating closing line' if summary['avg_clv'] > 0 else '[FAIL] behind closing line'}")

    print(f"\n  PER-MARKET BREAKDOWN")
    for mkt, stats in summary.get('per_market', {}).items():
        print(f"    {mkt}: {stats['count']} picks, WR {stats['win_rate']*100:.1f}%, ROI {stats['roi']:+.1f}%, Brier {stats['brier']:.4f}")

    print(f"\n  DISTRIBUTION SANITY CHECK")
    for key in ['check1', 'check2', 'check3']:
        check = sanity[key]
        status = "PASS [OK]" if check['pass'] else "FAIL [FAIL]"
        details = {k: v for k, v in check.items() if k not in ('pass', 'description')}
        print(f"    {key}: {status} - {check['description']}  {details}")
    overall_status = "PASS [OK]" if sanity['overall'] else "FAIL [FAIL] - DO NOT SEED"
    print(f"    OVERALL: {overall_status}")

    # Flags
    print(f"\n  FLAGS")
    wr = summary['win_rate']
    if wr > 0.65:
        print(f"    [!] WIN RATE {wr*100:.1f}% > 65% - suspect overfit/lookahead. Investigate.")
    elif wr < 0.52:
        print(f"    [!] WIN RATE {wr*100:.1f}% < 52% - model may be underperforming.")
    else:
        print(f"    [OK] Win rate {wr*100:.1f}% in healthy 52-58% band.")

    if summary['roi'] > 8:
        print(f"    [!] ROI {summary['roi']:+.1f}% > 8% - audit for bias.")
    elif summary['roi'] < 1:
        print(f"    [!] ROI {summary['roi']:+.1f}% < 1% - model edge may be insufficient.")
    else:
        print(f"    [OK] ROI {summary['roi']:+.1f}% in reasonable 1-8% band.")

    if summary['max_drawdown'] > 15:
        print(f"    [!] MAX DRAWDOWN {summary['max_drawdown']:.1f} > 15 units - high risk.")

    print(f"\n  QUOTA USAGE: 0 API calls (all from CSV)")
    print("=" * 70)


def save_output_json(picks: list, summary: dict, sanity: dict, filepath: str):
    """Save picks and summary to JSON file."""
    os.makedirs(os.path.dirname(filepath), exist_ok=True)

    # Serialize picks (remove non-serializable match dict)
    serializable_picks = []
    for p in picks:
        sp = {k: v for k, v in p.items() if k != 'match'}
        serializable_picks.append(sp)

    output = {
        'generated_at': datetime.utcnow().isoformat(),
        'summary': summary,
        'sanity_check': sanity,
        'picks': serializable_picks,
    }

    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(output, f, indent=2, default=str)
    print(f"\n  Output written to: {filepath}")


def seed_to_supabase(picks: list, summary: dict):
    """Write picks to Supabase (daily_picks, public_ledger, backtest_summary)."""
    # Import Supabase client
    from services.supabase_client import supabase

    if supabase is None:
        print("SEED ABORTED: Supabase credentials required.")
        print("Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env")
        sys.exit(1)

    print(f"\n  Seeding {len(picks)} picks to Supabase...")

    # Upsert daily_picks
    daily_picks_rows = []
    for p in picks:
        daily_picks_rows.append({
            'id': p['signal_id'],
            'fixture_id': f"{p['home_team']}_{p['away_team']}_{p['date']}",
            'league': p['league'],
            'home_team': p['home_team'],
            'away_team': p['away_team'],
            'kickoff_utc': p['date'],
            'market_type': p['market_type'],
            'prediction': p['pick'],
            'model_probability': p['model_prob'],
            'fair_odds': p['fair_odds'],
            'market_odds': p['market_odds'],
            'market_bookmaker': 'B365',
            'edge_pct': p['edge_pct'],
            'confidence': p['confidence'],
            'verdict': p['verdict'],
            'reasoning': p['reasoning'],
            'status': p['result'],
            'actual_score': f"{p['fthg']}-{p['ftag']}",
            'profit_loss': p['pnl'],
            'clv': round((p['market_odds'] / p['pinnacle_closing_odds'] - 1) * 100, 2)
                  if p.get('pinnacle_closing_odds') and p['pinnacle_closing_odds'] > 0 else None,
            'source': 'backtest',
        })

    # Batch upsert in chunks of 100
    for i in range(0, len(daily_picks_rows), 100):
        chunk = daily_picks_rows[i:i + 100]
        supabase.table('daily_picks').upsert(chunk, on_conflict='id').execute()
    print(f"    ✓ daily_picks: {len(daily_picks_rows)} rows upserted")

    # Upsert public_ledger
    ledger_rows = []
    for p in picks:
        ledger_rows.append({
            'signal_id': p['signal_id'],
            'match': f"{p['home_team']} vs {p['away_team']}",
            'prediction': p['pick'],
            'odds': p['market_odds'],
            'edge': p['edge_pct'],
            'confidence': p['confidence'],
            'result': p['result'],
            'profit_loss': p['pnl'],
            'cumulative_profit': p.get('cumulative_profit', 0),
            'source': 'backtest',
        })

    for i in range(0, len(ledger_rows), 100):
        chunk = ledger_rows[i:i + 100]
        supabase.table('public_ledger').upsert(chunk, on_conflict='signal_id').execute()
    print(f"    ✓ public_ledger: {len(ledger_rows)} rows upserted")

    # Upsert backtest_summary (single row)
    summary_row = {
        'id': 1,
        'seasons': '2324,2425,2526',
        'total_matches': summary.get('total_matches', 0),
        'total_picks': summary['total_picks'],
        'win_rate': summary['win_rate'],
        'roi': summary['roi'],
        'brier': summary['brier_overall'],
        'avg_clv': summary['avg_clv'],
        'max_drawdown': summary['max_drawdown'],
        'per_market': json.dumps(summary.get('per_market', {})),
        'generated_at': datetime.utcnow().isoformat(),
    }
    supabase.table('backtest_summary').upsert(summary_row, on_conflict='id').execute()
    print(f"    ✓ backtest_summary: upserted")

    # Set live_start_date on track_record
    supabase.table('track_record').update({
        'live_start_date': datetime.utcnow().strftime('%Y-%m-%d')
    }).eq('id', supabase.table('track_record').select('id').limit(1).execute().data[0]['id'] if supabase.table('track_record').select('id').limit(1).execute().data else None).execute()
    print(f"    ✓ track_record.live_start_date set to today")

    print(f"\n  SEED COMPLETE ✓")


def main():
    parser = argparse.ArgumentParser(description='HandicapLab Historical Backtest Seeder')
    parser.add_argument('--dry-run', action='store_true', default=True,
                        help='Compute + print report, no DB writes (default)')
    parser.add_argument('--output-json', action='store_true',
                        help='Same as dry-run + write clean picks JSON')
    parser.add_argument('--seed', action='store_true',
                        help='Write to Supabase (REQUIRES credentials)')

    args = parser.parse_args()

    # --seed requires Supabase credentials
    if args.seed:
        url = os.environ.get('SUPABASE_URL', '')
        key = os.environ.get('SUPABASE_SERVICE_KEY', '')
        if not url or not key or url == 'mock' or key == 'mock':
            print("=" * 50)
            print("SEED ABORTED: Supabase credentials required.")
            print("Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env")
            print("=" * 50)
            sys.exit(1)

    # ── Phase 1: Download CSVs ──
    print("\n[PHASE 1] Downloading historical CSVs...")
    downloaded_paths, skipped = download_all(delay=1.0)

    if not downloaded_paths:
        print("ERROR: No CSV files downloaded. Check network/URLs.")
        sys.exit(1)

    coverage = {
        'downloaded': len(downloaded_paths),
        'total': 18,
        'skipped': skipped,
    }

    # ── Phase 2: Parse CSVs ──
    print("\n[PHASE 2] Parsing CSVs...")
    matches_by_league = parse_all(downloaded_paths)

    total_matches = sum(len(m) for m in matches_by_league.values())
    coverage['total_matches'] = total_matches

    if total_matches < 100:
        print(f"ERROR: Only {total_matches} matches parsed. Insufficient data.")
        sys.exit(1)

    # ── Phase 3: Walk-Forward Backtest ──
    print("\n[PHASE 3] Running walk-forward backtest...")
    settled_picks, all_predictions = run_backtest(matches_by_league)

    if not settled_picks:
        print("ERROR: No picks generated. Model may need tuning.")
        sys.exit(1)

    # ── Phase 4: Compute Metrics ──
    print("\n[PHASE 4] Computing metrics...")
    summary = compute_summary(settled_picks)
    summary['total_matches'] = total_matches

    # ── Phase 5: Sanity Check (SEEDING GATE) ──
    print("\n[PHASE 5] Distribution sanity check...")
    sanity = distribution_sanity_check(all_predictions)

    # ── Phase 6: Report ──
    print_report(summary, sanity, coverage, settled_picks)

    # Save output JSON (always for dry-run, optionally for --output-json)
    output_path = os.path.join(OUTPUT_DIR, "backtest_dryrun.json")
    save_output_json(settled_picks, summary, sanity, output_path)

    # ── Gate: check sanity before seeding ──
    if not sanity['overall']:
        print("\n  ✗ SANITY CHECK FAILED — SEEDING BLOCKED.")
        print("  Fix model before seeding. Do not present broken backtest as proof.")
        sys.exit(1)

    if summary['brier_overall'] >= 0.25:
        print(f"\n  ✗ BRIER {summary['brier_overall']:.4f} >= 0.25 — model not better than random.")
        print("  Do not seed. Fix model first.")
        sys.exit(1)

    if not args.seed:
        print("\n  STEP 6 DRY-RUN COMPLETE — AWAITING SEED APPROVAL")
        print("  Run with --seed to write to Supabase.")
        return

    # ── Phase 7: Seed to Supabase ──
    print("\n[PHASE 7] Seeding to Supabase...")
    seed_to_supabase(settled_picks, summary)

    print(f"\n  STEP 6 COMPLETE — LEDGER SEEDED")
    print(f"    {summary['total_picks']} picks | WR {summary['win_rate']*100:.1f}% | "
          f"ROI {summary['roi']:+.1f}% | Brier {summary['brier_overall']:.4f} | "
          f"CLV {summary['avg_clv']:+.1f}%")


if __name__ == "__main__":
    main()
