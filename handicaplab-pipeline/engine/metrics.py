"""
Performance Metrics
===================
Computes win_rate, ROI, Brier score, CLV, drawdown, and calibration.

Includes Distribution Sanity Check to catch model pathologies before seeding.
"""

import logging
import math
from typing import Any, Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)


def compute_win_rate(wins: float, total: int) -> float:
    if total == 0:
        return 0.0
    return wins / total * 100.0


def compute_roi(profit: float, stake: float) -> float:
    if stake == 0:
        return 0.0
    return profit / stake * 100.0


def compute_max_drawdown(cumulative_pnl: List[float]) -> float:
    """
    Maximum drawdown from peak cumulative P&L.

    Args:
        cumulative_pnl: Running total of P&L after each pick

    Returns:
        Max drawdown as a positive percentage
    """
    if not cumulative_pnl:
        return 0.0

    peak = cumulative_pnl[0]
    max_dd = 0.0

    for pnl in cumulative_pnl:
        if pnl > peak:
            peak = pnl
        dd = peak - pnl
        if dd > max_dd:
            max_dd = dd

    # Convert to percentage of initial stake (assuming 1 unit per pick)
    total_stake = len(cumulative_pnl)
    if total_stake == 0:
        return 0.0
    return max_dd / total_stake * 100.0


def compute_brier_score(
    probabilities: List[float], outcomes: List[int]
) -> float:
    """
    Brier score = mean((prob - outcome)^2).

    Args:
        probabilities: Model probabilities (0.0-1.0)
        outcomes: Actual outcomes (1 = win, 0 = loss)

    Returns:
        Mean Brier score (lower is better, baseline = 0.25)
    """
    if not probabilities or len(probabilities) != len(outcomes):
        return 0.25

    scores = [(p - o) ** 2 for p, o in zip(probabilities, outcomes)]
    return float(np.mean(scores))


def compute_avg_clv(
    market_odds: List[float], pinnacle_odds: List[float]
) -> float:
    """
    Average Closing Line Value.

    clv = (retail_odds / pinnacle_closing_odds - 1) * 100

    Args:
        market_odds: Retail odds used by the pick
        pinnacle_odds: Pinnacle closing odds for same selection

    Returns:
        Average CLV %
    """
    if not market_odds or not pinnacle_odds:
        return 0.0

    valid = [(m, p) for m, p in zip(market_odds, pinnacle_odds) if m > 0 and p > 0]
    if not valid:
        return 0.0

    clvs = [(m / p - 1) * 100 for m, p in valid]
    return float(np.mean(clvs))


def compute_calibration(
    probabilities: List[float], outcomes: List[int], n_bins: int = 10
) -> List[Dict[str, float]]:
    """
    Reliability curve data for calibration plot.

    Args:
        probabilities: Model probabilities
        outcomes: Actual outcomes (0/1)
        n_bins: Number of bins

    Returns:
        List of dicts with bin_center, accuracy, count
    """
    if not probabilities:
        return []

    bins = np.linspace(0, 1, n_bins + 1)
    calibration = []

    for i in range(n_bins):
        mask = (np.array(probabilities) >= bins[i]) & (
            np.array(probabilities) < bins[i + 1]
        )
        bin_probs = np.array(probabilities)[mask]
        bin_outcomes = np.array(outcomes)[mask]

        if len(bin_probs) == 0:
            continue

        calibration.append({
            "bin_center": float(np.mean(bin_probs)),
            "accuracy": float(np.mean(bin_outcomes)),
            "count": int(len(bin_probs)),
        })

    return calibration


def sanity_check(
    picks: List[Dict[str, Any]],
) -> tuple[bool, str]:
    """
    Distribution sanity check (from Analisis Strategi Taruhan Olahraga Global).

    RED FLAGs:
    - AH_home_prob must sit 0.35-0.65
    - BTTS 0.40-0.70
    - ML_home > 0.75 en masse = model inflation → abort seeding

    Args:
        picks: List of backtest pick dicts

    Returns:
        (passed: bool, message: str)
    """
    if not picks:
        return True, "No picks to check"

    ml_home_probs = []
    ah_home_probs = []

    for p in picks:
        if p.get("market_type") == "moneyline" and "HOME" in p.get("prediction", ""):
            ml_home_probs.append(p.get("model_probability", 0))
        elif p.get("market_type") == "asian_handicap" and "HOME" in p.get("prediction", ""):
            ah_home_probs.append(p.get("model_probability", 0))

    issues = []

    if ml_home_probs:
        pct_above_75 = sum(1 for p in ml_home_probs if p > 0.75) / len(ml_home_probs)
        if pct_above_75 > 0.30:
            issues.append(
                f"RED FLAG: {pct_above_75*100:.1f}% of ML home probs > 0.75 "
                f"(threshold: 30%)"
            )

    if ah_home_probs:
        min_prob = min(ah_home_probs)
        max_prob = max(ah_home_probs)
        if min_prob < 0.35 or max_prob > 0.65:
            issues.append(
                f"RED FLAG: AH home prob range [{min_prob:.2f}, {max_prob:.2f}] "
                f"outside [0.35, 0.65]"
            )

    if issues:
        return False, "; ".join(issues)

    return True, "PASS"


def summarize(picks: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Compute full performance summary from settled backtest picks.

    Args:
        picks: List of backtest pick dicts with result and pnl populated

    Returns:
        Summary dict with all metrics
    """
    if not picks:
        return {
            "total_matches": 0,
            "total_picks": 0,
            "win_rate": 0.0,
            "roi": 0.0,
            "brier": 0.25,
            "avg_clv": 0.0,
            "max_drawdown": 0.0,
        }

    total = len(picks)
    wins = sum(1 for p in picks if p.get("result") == "WON")
    half_wins = sum(0.5 for p in picks if p.get("result") == "HALF_WIN")
    pushes = sum(1 for p in picks if p.get("result") == "PUSH")
    losses = sum(1 for p in picks if p.get("result") == "LOST")
    half_losses = sum(0.5 for p in picks if p.get("result") == "HALF_LOSS")

    effective_wins = wins + half_wins
    effective_losses = losses + half_losses

    total_pnl = sum(p.get("pnl", 0.0) for p in picks)

    cumulative = []
    running = 0.0
    for p in picks:
        running += p.get("pnl", 0.0)
        cumulative.append(running)

    win_rate = compute_win_rate(effective_wins, total)
    roi = compute_roi(total_pnl, total)
    max_dd = compute_max_drawdown(cumulative)

    # Brier score
    probs = [p.get("model_probability", 0.5) for p in picks]
    outcomes = []
    for p in picks:
        r = p.get("result", "")
        if r in ("WON", "HALF_WIN"):
            outcomes.append(1)
        elif r in ("PUSH",):
            outcomes.append(p.get("model_probability", 0.5))
        else:
            outcomes.append(0)
    brier = compute_brier_score(probs, outcomes)

    # CLV
    b365_odds = [p.get("b365_odds", 0.0) for p in picks if p.get("b365_odds", 0) > 0]
    pinnacle_odds = [
        p.get("pinnacle_odds", 0.0) for p in picks if p.get("pinnacle_odds", 0) > 0
    ]
    min_len = min(len(b365_odds), len(pinnacle_odds))
    avg_clv = compute_avg_clv(b365_odds[:min_len], pinnacle_odds[:min_len])

    # Per-market breakdown
    markets = {}
    for p in picks:
        m = p.get("market_type", "unknown")
        if m not in markets:
            markets[m] = {"count": 0, "wins": 0, "pnl": 0.0}
        markets[m]["count"] += 1
        r = p.get("result", "")
        if r == "WON":
            markets[m]["wins"] += 1
        elif r == "HALF_WIN":
            markets[m]["wins"] += 0.5
        markets[m]["pnl"] += p.get("pnl", 0.0)

    return {
        "total_matches": len(set(p.get("fixture_key") for p in picks)),
        "total_picks": total,
        "win_rate": round(win_rate, 2),
        "roi": round(roi, 2),
        "brier": round(brier, 4),
        "avg_clv": round(avg_clv, 4),
        "max_drawdown": round(max_dd, 2),
        "per_market": {
            m: {
                "count": v["count"],
                "win_rate": round(v["wins"] / v["count"] * 100, 2) if v["count"] > 0 else 0,
                "roi": round(compute_roi(v["pnl"], v["count"]), 2),
            }
            for m, v in markets.items()
        },
    }
