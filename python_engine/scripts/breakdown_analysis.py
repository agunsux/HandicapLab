import json
import os
import sys
from collections import defaultdict
from datetime import datetime

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'historical', 'output', 'backtest_dryrun.json')
REPORT_OUT = os.path.join(os.path.dirname(__file__), '..', 'data', 'historical', 'output', 'breakdown_analysis.json')

def load_data():
    if not os.path.exists(OUTPUT_FILE):
        print(f"File not found: {OUTPUT_FILE}")
        sys.exit(1)
    with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def get_season(date_str, league):
    # e.g. "2023-08-11T00:00:00Z"
    if not date_str:
        return "Unknown"
    
    try:
        dt = datetime.strptime(date_str[:10], "%Y-%m-%d")
    except:
        return "Unknown"

    if league == 'Brasileirao' or league == 'Brazil Serie A':
        return str(dt.year)
    else:
        # Aug-Jul
        if dt.month >= 7:
            return f"{dt.year}/{str(dt.year+1)[-2:]}"
        else:
            return f"{dt.year-1}/{str(dt.year)[-2:]}"

def get_backed_side(pick_str):
    pick_str = str(pick_str).upper()
    if 'HOME' in pick_str or ' 1' in pick_str or pick_str == '1' or 'AH_H' in pick_str:
        return 'HOME'
    elif 'AWAY' in pick_str or ' 2' in pick_str or pick_str == '2' or 'AH_A' in pick_str:
        return 'AWAY'
    elif 'DRAW' in pick_str or ' X' in pick_str or pick_str == 'X':
        return 'DRAW'
    elif 'OVER' in pick_str or 'O2.5' in pick_str or 'YES' in pick_str:
        return 'OVER/YES'
    elif 'UNDER' in pick_str or 'U2.5' in pick_str or 'NO' in pick_str:
        return 'UNDER/NO'
    return 'OTHER'

def compute_bucket_metrics(picks):
    if not picks:
        return {'count': 0, 'roi': 0, 'clv': 0, 'brier': 0, 'win_rate': 0, 'tag': 'INSUFFICIENT (0 picks)'}
    
    count = len(picks)
    pnl_sum = sum([p.get('pnl', 0) for p in picks])
    
    # ROI: (Total PNL / (count * 1_unit)) * 100 since each bet is 1 unit
    # wait, if each bet is 1 unit, ROI is pnl_sum / count * 100
    roi = (pnl_sum / count) * 100
    
    valid_clv = []
    for p in picks:
        closing = p.get('pinnacle_closing_odds')
        market = p.get('market_odds')
        if closing is not None and market is not None and market > 0:
            valid_clv.append((closing / market - 1) * 100)
    avg_clv = sum(valid_clv) / len(valid_clv) if valid_clv else 0
    
    brier_sum = 0
    valid_brier = 0
    wins = 0
    for p in picks:
        prob = p.get('model_prob', 0)
        status = p.get('result', 'PENDING')
        if status == 'WON':
            brier_sum += (prob - 1.0) ** 2
            valid_brier += 1
            wins += 1
        elif status == 'LOST':
            brier_sum += (prob - 0.0) ** 2
            valid_brier += 1
        elif status == 'HALF_WIN':
            brier_sum += (prob - 0.5) ** 2
            valid_brier += 1
            wins += 0.5
        elif status == 'HALF_LOSS':
            brier_sum += (prob - 0.5) ** 2
            valid_brier += 1
            wins += 0
            
    brier = brier_sum / valid_brier if valid_brier else 0
    win_rate = (wins / count) * 100 if count else 0
    
    tag = "ok"
    if count < 20: tag = "INSUFFICIENT (do not conclude)"
    elif count <= 50: tag = "LOW SAMPLE (interpret with caution)"
    
    return {
        'count': count,
        'roi': roi,
        'clv': avg_clv,
        'brier': brier,
        'win_rate': win_rate,
        'tag': tag
    }

def print_table(title, buckets_dict):
    print(f"\n--- {title} ---")
    print(f"{'Bucket':<20} | {'Picks':<6} | {'ROI %':<8} | {'CLV %':<8} | {'Brier':<6} | {'Win %':<6} | Tag")
    print("-" * 80)
    for k in sorted(buckets_dict.keys()):
        m = compute_bucket_metrics(buckets_dict[k])
        print(f"{str(k):<20} | {m['count']:<6} | {m['roi']:>+7.2f}% | {m['clv']:>+7.2f}% | {m['brier']:.4f} | {m['win_rate']:>5.1f}% | {m['tag']}")

def run_breakdown():
    data = load_data()
    all_picks = data.get('picks', [])
    if not all_picks:
        print("No picks found.")
        return
        
    markets = defaultdict(list)
    leagues = defaultdict(list)
    odds_buckets = defaultdict(list)
    backed_sides = defaultdict(list)
    edge_buckets = defaultdict(list)
    conf_buckets = defaultdict(list)
    seasons = defaultdict(list)
    
    for pick in all_picks:
        # Market
        markets[pick.get('market_type', 'UNKNOWN')].append(pick)
        
        # League
        leagues[pick.get('league', 'UNKNOWN')].append(pick)
        
        # Odds Bucket
        odds = pick.get('market_odds', 0)
        if odds < 1.20: ob = "<1.20"
        elif odds <= 1.50: ob = "1.20-1.50"
        elif odds <= 1.80: ob = "1.50-1.80"
        elif odds <= 2.20: ob = "1.80-2.20"
        elif odds <= 3.00: ob = "2.20-3.00"
        else: ob = "3.00+"
        odds_buckets[ob].append(pick)
        
        # Backed Side
        backed_sides[get_backed_side(pick.get('pick'))].append(pick)
        
        # Claimed Edge
        edge = pick.get('edge_pct', 0)
        if edge < 3: eb = "<3%"
        elif edge <= 5: eb = "3-5%"
        elif edge <= 8: eb = "5-8%"
        else: eb = "8%+"
        edge_buckets[eb].append(pick)
        
        # Confidence
        conf = pick.get('confidence', 0)
        if conf < 70: cb = "<70"
        elif conf <= 75: cb = "70-75"
        elif conf <= 80: cb = "75-80"
        elif conf <= 85: cb = "80-85"
        else: cb = "85+"
        conf_buckets[cb].append(pick)
        
        # Season
        seasons[get_season(pick.get('date'), pick.get('league'))].append(pick)

    print("======================================================")
    print("  PHASE A.5: DIAGNOSTIC BREAKDOWN")
    print("======================================================")
    
    print_table("1. MARKET", markets)
    print("AUTO-INSIGHT: Market performance varies. Compare CLV/ROI across AH, ML, OU.")
    
    print_table("2. LEAGUE", leagues)
    print("AUTO-INSIGHT: Check if the model is structurally broken on a specific league.")
    
    print_table("3. ODDS BUCKET", odds_buckets)
    print("AUTO-INSIGHT: Heavy favorites (low odds) vs Underdogs. Tail overconfidence usually destroys low-odds ROI.")
    
    print_table("4. BACKED SIDE", backed_sides)
    print("AUTO-INSIGHT: If HOME backed picks have worse CLV, the home advantage parameter (gamma) is inflated.")
    
    print_table("5. CLAIMED-EDGE BUCKET", edge_buckets)
    print("AUTO-INSIGHT: If 8%+ edge bucket has WORST CLV, the edge signal is inverted (noise).")
    
    print_table("6. CONFIDENCE BUCKET", conf_buckets)
    print("AUTO-INSIGHT: Does high confidence actually correlate with higher win rate / better CLV?")
    
    print_table("7. SEASON", seasons)
    print("AUTO-INSIGHT: Is ROI/CLV declining chronologically due to market efficiency?")

    # Save to JSON
    report = {
        'markets': {k: compute_bucket_metrics(v) for k, v in markets.items()},
        'leagues': {k: compute_bucket_metrics(v) for k, v in leagues.items()},
        'odds_buckets': {k: compute_bucket_metrics(v) for k, v in odds_buckets.items()},
        'backed_sides': {k: compute_bucket_metrics(v) for k, v in backed_sides.items()},
        'edge_buckets': {k: compute_bucket_metrics(v) for k, v in edge_buckets.items()},
        'conf_buckets': {k: compute_bucket_metrics(v) for k, v in conf_buckets.items()},
        'seasons': {k: compute_bucket_metrics(v) for k, v in seasons.items()}
    }
    with open(REPORT_OUT, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2)
        
    print("\nReport saved to: " + REPORT_OUT)
    print("PHASE A.5 COMPLETE")

if __name__ == '__main__':
    run_breakdown()
