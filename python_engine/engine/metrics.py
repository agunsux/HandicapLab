"""
engine/metrics.py — Brier score, CLV, ROI, drawdown, calibration, distribution sanity check.
THIS is the single source of truth for all evaluation metrics and sanity checks.
"""
import numpy as np
from typing import List, Dict, Any, Tuple


def win_rate(picks: List[Dict]) -> float:
    """Win rate counting half-wins as 0.5."""
    from engine.settlement import win_count, is_countable
    countable = [p for p in picks if is_countable(p.get('result', ''))]
    if not countable:
        return 0.0
    wins = sum(win_count(p['result']) for p in countable)
    return wins / len(countable)


def roi(picks: List[Dict]) -> float:
    """ROI = total profit / total stake * 100. Each pick = 1 unit stake."""
    if not picks:
        return 0.0
    total_pnl = sum(p.get('pnl', 0.0) for p in picks)
    return (total_pnl / len(picks)) * 100


def max_drawdown(picks: List[Dict]) -> float:
    """Max drawdown on cumulative P&L curve."""
    if not picks:
        return 0.0
    cumulative = 0.0
    peak = 0.0
    worst_dd = 0.0
    for p in picks:
        cumulative += p.get('pnl', 0.0)
        if cumulative > peak:
            peak = cumulative
        dd = peak - cumulative
        if dd > worst_dd:
            worst_dd = dd
    return worst_dd


def brier_score(picks: List[Dict], market_filter: str = None) -> float:
    """
    Brier = mean((model_prob - outcome)^2).
    outcome = 1 if WON or HALF_WIN, 0 if LOST or HALF_LOSS, excluded if PUSH.
    Baseline (random) = 0.25. Lower is better.
    """
    filtered = picks
    if market_filter:
        filtered = [p for p in picks if p.get('market_type') == market_filter]

    scored = []
    for p in filtered:
        r = p.get('result', '')
        if r in ('PUSH',):
            continue
        outcome = 1.0 if r in ('WON', 'HALF_WIN') else 0.0
        prob = p.get('model_prob', 0.5)
        scored.append((prob, outcome))

    if not scored:
        return 0.25  # baseline
    return float(np.mean([(prob - outcome) ** 2 for prob, outcome in scored]))


def avg_clv(picks: List[Dict]) -> float:
    """
    avg CLV = mean((B365_odds / pinnacle_closing_odds - 1) * 100).
    Only picks with valid Pinnacle closing odds are included.
    """
    clv_values = []
    for p in picks:
        b365 = p.get('market_odds')
        pinnacle = p.get('pinnacle_closing_odds')
        if b365 and pinnacle and pinnacle > 0 and b365 > 0:
            clv = (b365 / pinnacle - 1) * 100
            clv_values.append(clv)
    if not clv_values:
        return 0.0
    return float(np.mean(clv_values))


def calibration_bins(picks: List[Dict], n_bins: int = 10) -> List[Dict]:
    """
    Group picks into n_bins by predicted probability.
    For each bin: mean predicted probability, actual win rate, count.
    """
    scored = []
    for p in picks:
        r = p.get('result', '')
        if r in ('PUSH',):
            continue
        outcome = 1.0 if r in ('WON', 'HALF_WIN') else 0.0
        scored.append((p.get('model_prob', 0.5), outcome))

    if not scored:
        return []

    scored.sort(key=lambda x: x[0])
    bin_size = max(1, len(scored) // n_bins)
    bins = []
    for i in range(0, len(scored), bin_size):
        chunk = scored[i:i + bin_size]
        probs = [c[0] for c in chunk]
        outcomes = [c[1] for c in chunk]
        bins.append({
            'mean_predicted': float(np.mean(probs)),
            'actual_rate': float(np.mean(outcomes)),
            'count': len(chunk),
        })
    return bins


def distribution_sanity_check(all_predictions: List[Dict]) -> Dict[str, Any]:
    """
    THE single source of truth for distribution sanity.
    
    CHECK 1: AH_home_prob 5th–95th percentile within [0.35, 0.65]
    CHECK 2: BTTS_yes mean within [0.40, 0.70]
    CHECK 3: fraction of matches with ML_home_prob > 0.75 must be < 20%
    
    all_predictions: list of dicts with keys:
        'p_home_win', 'p_draw', 'p_away_win',
        'p_over_25' (used as proxy for BTTS when BTTS not available),
        'ah_home_prob' (optional, computed from score matrix)
    
    Returns: {
        'check1': {'pass': bool, 'p5': float, 'p95': float},
        'check2': {'pass': bool, 'mean_btts': float},
        'check3': {'pass': bool, 'frac_above_75': float},
        'overall': bool
    }
    """
    result = {
        'check1': {'pass': True, 'p5': 0.0, 'p95': 0.0, 'description': 'AH_home_prob 5th-95th in [0.35, 0.65]'},
        'check2': {'pass': True, 'mean_btts': 0.0, 'description': 'BTTS/O2.5 mean in [0.40, 0.70]'},
        'check3': {'pass': True, 'frac_above_75': 0.0, 'description': 'ML_home >0.75 fraction < 20%'},
        'overall': True,
    }

    # CHECK 1: AH home probability distribution
    ah_probs = [p.get('ah_home_prob', p.get('p_home_win', 0.5)) for p in all_predictions]
    if ah_probs:
        p5 = float(np.percentile(ah_probs, 5))
        p95 = float(np.percentile(ah_probs, 95))
        result['check1']['p5'] = round(p5, 4)
        result['check1']['p95'] = round(p95, 4)
        result['check1']['pass'] = (p5 >= 0.35 and p95 <= 0.65)

    # CHECK 2: BTTS / Over 2.5 mean (proxy for BTTS when unavailable)
    btts_probs = [p.get('p_btts', p.get('p_over_25', 0.5)) for p in all_predictions]
    if btts_probs:
        mean_btts = float(np.mean(btts_probs))
        result['check2']['mean_btts'] = round(mean_btts, 4)
        result['check2']['pass'] = (0.40 <= mean_btts <= 0.70)

    # CHECK 3: ML home bias
    home_probs = [p.get('p_home_win', 0.5) for p in all_predictions]
    if home_probs:
        frac = sum(1 for p in home_probs if p > 0.75) / len(home_probs)
        result['check3']['frac_above_75'] = round(frac, 4)
        result['check3']['pass'] = (frac < 0.20)

    result['overall'] = result['check1']['pass'] and result['check2']['pass'] and result['check3']['pass']
    return result


def compute_summary(picks: List[Dict]) -> Dict[str, Any]:
    """Compute full summary metrics for a set of settled picks."""
    wr = win_rate(picks)
    r = roi(picks)
    md = max_drawdown(picks)
    bs_overall = brier_score(picks)
    bs_ml = brier_score(picks, 'ML')
    bs_ou = brier_score(picks, 'OU')
    bs_ah = brier_score(picks, 'AH')
    clv = avg_clv(picks)
    cal = calibration_bins(picks)

    total_pnl = sum(p.get('pnl', 0.0) for p in picks)

    per_market = {}
    for mkt in ['ML', 'OU', 'AH']:
        mkt_picks = [p for p in picks if p.get('market_type') == mkt]
        if mkt_picks:
            per_market[mkt] = {
                'count': len(mkt_picks),
                'win_rate': round(win_rate(mkt_picks), 4),
                'roi': round(roi(mkt_picks), 2),
                'brier': round(brier_score(mkt_picks), 4),
            }

    return {
        'total_picks': len(picks),
        'win_rate': round(wr, 4),
        'roi': round(r, 2),
        'cumulative_profit': round(total_pnl, 2),
        'max_drawdown': round(md, 2),
        'brier_overall': round(bs_overall, 4),
        'brier_ml': round(bs_ml, 4),
        'brier_ou': round(bs_ou, 4),
        'brier_ah': round(bs_ah, 4),
        'avg_clv': round(clv, 2),
        'per_market': per_market,
        'calibration': cal,
    }
