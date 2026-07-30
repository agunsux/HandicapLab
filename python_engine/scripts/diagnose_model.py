import json
import os
import sys
import numpy as np

OUTPUT_FILE = os.path.join(os.path.dirname(__file__), '..', 'data', 'historical', 'output', 'backtest_dryrun.json')

def load_data():
    if not os.path.exists(OUTPUT_FILE):
        print(f"File not found: {OUTPUT_FILE}")
        sys.exit(1)
    with open(OUTPUT_FILE, 'r', encoding='utf-8') as f:
        return json.load(f)

def run_diagnostics():
    data = load_data()
    all_picks = data.get('picks', [])
    
    if not all_picks:
        print("No picks found in dry-run output.")
        sys.exit(1)

    print("======================================================")
    print("  PHASE A: DIAGNOSTIC REPORT")
    print("======================================================\n")

    # 1. RELIABILITY CURVE
    print("1. RELIABILITY CURVE (Model Calibration)")
    bins = [i/10.0 for i in range(11)]
    bin_counts = {i: 0 for i in range(10)}
    bin_wins = {i: 0 for i in range(10)}
    bin_sum_prob = {i: 0.0 for i in range(10)}
    
    for pick in all_picks:
        prob = pick.get('model_prob', 0)
        # Find which bin this belongs to
        b = int(prob * 10)
        if b >= 10: b = 9
        
        bin_counts[b] += 1
        bin_sum_prob[b] += prob
        
        # Win calculation based on outcome
        status = pick.get('result', 'PENDING')
        if status == 'WON':
            bin_wins[b] += 1
        elif status == 'HALF_WIN':
            bin_wins[b] += 0.5
        elif status == 'HALF_LOSS':
            bin_wins[b] += 0.0 
            
    print("  Bin        | Picks  | Mean Pred | Actual Win % | Bias (Overconfidence)")
    print("  ----------------------------------------------------------------------")
    for i in range(10):
        if bin_counts[i] > 0:
            mean_pred = bin_sum_prob[i] / bin_counts[i]
            actual_win_pct = bin_wins[i] / bin_counts[i]
            bias = mean_pred - actual_win_pct
            print(f"  {i/10:.1f} - {(i+1)/10:.1f} | {bin_counts[i]:<6} | {mean_pred:.4f}    | {actual_win_pct:.4f}       | {bias:+.4f}")
        else:
            print(f"  {i/10:.1f} - {(i+1)/10:.1f} | 0      | N/A       | N/A          | N/A")
    
    print("\n")

    # 2. SELECTIVITY
    print("2. SELECTIVITY")
    total_matches = data.get('coverage', {}).get('total_matches_parsed', 6187)
    total_picks = len(all_picks)
    pick_rate = total_picks / total_matches if total_matches else 0
    print(f"  Total Matches: {total_matches}")
    print(f"  Total Picks:   {total_picks}")
    print(f"  Pick Rate:     {pick_rate*100:.1f}%")
    if pick_rate > 0.2:
        print("  [!] WARNING: Pick rate > 20%. Real edges are rare. Model is likely overbetting.")
    
    edge_pcts = [p.get('edge_pct', 0) for p in all_picks]
    if edge_pcts:
        print(f"  Edge % Dist:   Min: {np.min(edge_pcts):.1f}% | Median: {np.median(edge_pcts):.1f}% | Max: {np.max(edge_pcts):.1f}%")
    print("\n")

    # 3. SELECTED-PICK BRIER
    print("3. SELECTED-PICK BRIER")
    brier_sum = 0
    valid_brier = 0
    for pick in all_picks:
        prob = pick.get('model_prob', 0)
        status = pick.get('result', 'PENDING')
        if status in ['WON', 'LOST']:
            actual = 1.0 if status == 'WON' else 0.0
            brier_sum += (prob - actual) ** 2
            valid_brier += 1
        elif status == 'HALF_WIN':
            brier_sum += (prob - 0.5) ** 2
            valid_brier += 1
        elif status == 'HALF_LOSS':
            brier_sum += (prob - 0.5) ** 2
            valid_brier += 1
    
    selected_brier = brier_sum / valid_brier if valid_brier else 0
    print(f"  Selected Pick Brier: {selected_brier:.4f} (on {valid_brier} settled picks)")
    print("\n")
    
    # 4. CLV SPLIT
    print("4. CLV SPLIT")
    layak_clvs = []
    pantau_clvs = []
    for pick in all_picks:
        closing = pick.get('pinnacle_closing_odds')
        market = pick.get('market_odds')
        verdict = pick.get('verdict', 'PANTAU')
        if closing is not None and market is not None and market > 0:
            clv = (closing / market - 1) * 100
            if verdict == 'LAYAK':
                layak_clvs.append(clv)
            else:
                pantau_clvs.append(clv)
                
    avg_layak_clv = np.mean(layak_clvs) if layak_clvs else 0
    avg_pantau_clv = np.mean(pantau_clvs) if pantau_clvs else 0
    print(f"  LAYAK Avg CLV:  {avg_layak_clv:+.2f}% (Count: {len(layak_clvs)})")
    print(f"  PANTAU Avg CLV: {avg_pantau_clv:+.2f}% (Count: {len(pantau_clvs)})")
    print("\n")
    
    # 5. TAIL CHECK
    print("5. TAIL CHECK (Model Prob Distribution of Selected Picks)")
    probs = [p.get('model_prob', 0) for p in all_picks]
    if probs:
        p5 = np.percentile(probs, 5)
        p50 = np.percentile(probs, 50)
        p95 = np.percentile(probs, 95)
        print(f"  Model Prob Dist: 5th: {p5:.4f} | 50th (Median): {p50:.4f} | 95th: {p95:.4f}")
        high_prob_count = sum(1 for p in probs if p > 0.7)
        print(f"  Picks with Prob > 0.70: {high_prob_count} ({high_prob_count/len(probs)*100:.1f}%)")
    
if __name__ == '__main__':
    run_diagnostics()
