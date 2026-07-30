"""
Walk-Forward Backtester
=======================
Honest backtesting using expanding windows with no lookahead.

For each league independently:
1. Sort matches by date ascending
2. Expanding window: train Dixon-Coles ONLY on matches with date < current match
3. Skip first 80 matches per league
4. Retrain every 40 matches (checkpoint), reuse cached params between
5. Unknown teams -> league-average attack/defense (handled by DixonColesModel)

Pick generation matches live pipeline exactly:
- model_prob from Dixon-Coles
- fair = 1/model_prob
- market_odds = B365 (soft book)
- edge_pct = ((fair/market_odds) - 1) * 100
- confidence = min(95, 50 + edge_pct*5 + form_bonus(0-15) + sample_bonus(0-10))
- PICK if edge_pct >= 3.0 AND confidence >= 70
- ONE pick per match (highest edge)
"""

import hashlib
import logging
import math
import os
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

import numpy as np

from config import DC_RHO, DC_XI, MIN_CONFIDENCE, MIN_EDGE_PCT
from models.dixon_coles import DixonColesModel
from engine.edge_detector import EdgeDetector
from engine.pick_generator import PickGenerator
from engine.settlement import settle_moneyline, settle_over_under, settle_asian_handicap
from cache.local_cache import LocalCache

logger = logging.getLogger(__name__)


@dataclass
class BacktestPick:
    fixture_key: str
    date: str
    league: str
    home_team: str
    away_team: str
    market_type: str
    prediction: str
    model_probability: float
    fair_odds: float
    market_odds: float
    edge_pct: float
    confidence: int
    verdict: str
    reasoning: str
    clv_reference: Optional[float]
    fthg: int
    ftag: int
    ah_line: float
    b365_odds: float
    pinnacle_odds: Optional[float]
    result: str = ""
    pnl: float = 0.0


def _fixture_key(match: Dict[str, Any]) -> str:
    return f"{match['date']}_{match['home_team']}_{match['away_team']}"


def _form_bonus(match: Dict[str, Any], prediction: str) -> int:
    if "form_last_5_home" not in match or "form_last_5_away" not in match:
        return 0
    home_form = match.get("form_last_5_home", [])
    away_form = match.get("form_last_5_away", [])
    home_wins = sum(1 for r in home_form if r == "W")
    away_losses = sum(1 for r in away_form if r == "L")
    return min(15, (home_wins + away_losses) * 3)


def _sample_bonus(match: Dict[str, Any]) -> int:
    home_played = match.get("matches_played_home", 0)
    away_played = match.get("matches_played_away", 0)
    total = home_played + away_played
    return min(10, total // 2)


def _build_reasoning(
    home_team: str,
    away_team: str,
    prediction: str,
    edge_pct: float,
    confidence: int,
    lambda_home: float,
    lambda_away: float,
    market_type: str,
) -> str:
    p_home = 0.0
    p_draw = 0.0
    p_away = 0.0

    if market_type == "moneyline":
        if "HOME" in prediction:
            p_home = 1.0 / (1.0 + edge_pct / 100.0)
        elif "AWAY" in prediction:
            p_away = 1.0 / (1.0 + edge_pct / 100.0)
        else:
            p_draw = 1.0 / (1.0 + edge_pct / 100.0)
    elif market_type == "asian_handicap":
        if "HOME" in prediction:
            p_home = 0.5 + edge_pct / 200.0
        else:
            p_away = 0.5 + edge_pct / 200.0
    elif market_type == "over_under":
        if "OVER" in prediction:
            p_home = 0.5 + edge_pct / 200.0
        else:
            p_away = 0.5 - edge_pct / 200.0

    p_home = max(0.01, min(0.99, p_home))
    p_draw = max(0.01, min(0.99, p_draw))
    p_away = max(0.01, min(0.99, p_away))

    lines = [
        f"Prediksi: {prediction}",
        f"Edge: {edge_pct:.1f}% | Confidence: {confidence}/100",
        f"xG Model: {home_team} {lambda_home:.2f} — {lambda_away:.2f} {away_team}",
        f"Peluang: {home_team} {p_home*100:.0f}% | Draw {p_draw*100:.0f}% | {away_team} {p_away*100:.0f}%",
    ]

    if market_type == "asian_handicap":
        lines.append("Analisis: Model mendeteksi mispricing pada garis Asian Handicap.")
    elif market_type == "over_under":
        total_xg = lambda_home + lambda_away
        lines.append(
            f"Total xG: {total_xg:.2f} — {'Over' if total_xg > 2.5 else 'Under'} 2.5 diunggulkan."
        )
    elif market_type == "moneyline":
        if "HOME" in prediction:
            lines.append(
                f"Analisis: {home_team} diunggulkan menang berdasarkan parameter Dixon-Coles."
            )
        elif "AWAY" in prediction:
            lines.append(
                f"Analisis: {away_team} memiliki nilai di laga tandang."
            )
        else:
            lines.append(
                "Analisis: Model melihat peluang imbang di atas ekspektasi pasar."
            )

    return " | ".join(lines)


def _to_dc_training(matches: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    return [
        {
            "home_team": m["home_team"],
            "away_team": m["away_team"],
            "home_goals": m["fthg"],
            "away_goals": m["ftag"],
            "timestamp": int(
                datetime.strptime(m["date"], "%Y-%m-%d").timestamp()
            ),
        }
        for m in matches
    ]


def _train_dc(matches: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not matches:
        return None

    cache = LocalCache(os.path.join(os.path.dirname(__file__), "..", "cache"))
    model = DixonColesModel(cache=cache)
    try:
        training = _to_dc_training(matches)
        return model.train(training)
    except Exception as e:
        logger.warning(f"[Backtester] DC training failed: {e}")
        return None


def run_backtest(matches: List[Dict[str, Any]]) -> List[BacktestPick]:
    """
    Run walk-forward backtest.

    Args:
        matches: All parsed matches across all leagues/seasons

    Returns:
        List of BacktestPick objects with results and P&L settled
    """
    if not matches:
        return []

    # Group by league
    by_league: Dict[str, List[Dict[str, Any]]] = {}
    for m in matches:
        league = m.get("league", "unknown")
        by_league.setdefault(league, []).append(m)

    all_picks: List[BacktestPick] = []
    detector = EdgeDetector(min_edge_pct=MIN_EDGE_PCT)
    pick_gen = PickGenerator(min_confidence=MIN_CONFIDENCE)

    for league, league_matches in by_league.items():
        # Sort by date
        league_matches.sort(key=lambda x: x["date"])

        # Skip first 80 matches (insufficient history)
        if len(league_matches) <= 80:
            logger.warning(
                f"[Backtester] {league}: only {len(league_matches)} matches, skipping"
            )
            continue

        training_matches = league_matches[:80]
        league_picks = []

        # Walk-forward expanding window
        for idx in range(80, len(league_matches)):
            current = league_matches[idx]

            # Retrain every 40 matches
            if (idx - 80) % 40 == 0:
                params = _train_dc(training_matches)
                if params is None:
                    training_matches.append(current)
                    continue
            else:
                # Reuse last params
                params = getattr(run_backtest, "_last_params", None)
                if params is None:
                    params = _train_dc(training_matches)
                    if params is None:
                        training_matches.append(current)
                        continue

            run_backtest._last_params = params

            # Build model_result from params
            home_team = current["home_team"]
            away_team = current["away_team"]

            attacks = params.get("attacks", {})
            defenses = params.get("defenses", {})
            gamma = params.get("home_advantage", 0.25)

            home_att = attacks.get(home_team, 0.0)
            home_def = defenses.get(home_team, 0.0)
            away_att = attacks.get(away_team, 0.0)
            away_def = defenses.get(away_team, 0.0)

            lambda_home = math.exp(gamma + home_att - away_def)
            lambda_away = math.exp(away_att - home_def)

            lambda_home = max(0.1, min(6.0, lambda_home))
            lambda_away = max(0.1, min(6.0, lambda_away))

            # Compute score matrix (simplified Poisson)
            score_matrix = np.zeros((10, 10))
            for i in range(10):
                for j in range(10):
                    from scipy.stats import poisson
                    p = poisson.pmf(i, lambda_home) * poisson.pmf(j, lambda_away)
                    score_matrix[i, j] = p
            score_matrix /= score_matrix.sum()

            p_home_win = float(sum(score_matrix[i, j] for i in range(10) for j in range(10) if i > j))
            p_draw = float(sum(score_matrix[i, j] for i in range(10) for j in range(10) if i == j))
            p_away_win = float(sum(score_matrix[i, j] for i in range(10) for j in range(10) if i < j))
            p_over_25 = float(sum(score_matrix[i, j] for i in range(10) for j in range(10) if i + j > 2))
            p_under_25 = 1.0 - p_over_25

            # AH probabilities
            ah_probs = {}
            ah_line = current.get("ah_line", 0.0)
            line_str = str(ah_line)
            diff = 0
            for i in range(10):
                for j in range(10):
                    m = i - j + ah_line
                    if m > 0:
                        diff += score_matrix[i, j]
                    elif m == 0:
                        diff += 0.5 * score_matrix[i, j]
            ah_probs[line_str] = round(diff, 4)

            model_result = {
                "lambda_home": round(lambda_home, 4),
                "lambda_away": round(lambda_away, 4),
                "p_home_win": round(p_home_win, 4),
                "p_draw": round(p_draw, 4),
                "p_away_win": round(p_away_win, 4),
                "p_over_25": round(p_over_25, 4),
                "p_under_25": round(p_under_25, 4),
                "ah_probabilities": ah_probs,
            }

            # Build match_odds dict for edge detection
            match_odds = {"bookmakers": {"b365": {}}}

            # Moneyline
            if current.get("b365h") and current.get("b365d") and current.get("b365a"):
                match_odds["bookmakers"]["b365"]["ml_home"] = current["b365h"]
                match_odds["bookmakers"]["b365"]["ml_draw"] = current["b365d"]
                match_odds["bookmakers"]["b365"]["ml_away"] = current["b365a"]

            # AH
            if current.get("b365_ahh") and current.get("b365_aha"):
                match_odds["bookmakers"]["b365"]["spread_line"] = current.get("ah_line", 0.0)
                match_odds["bookmakers"]["b365"]["spread_home_odds"] = current["b365_ahh"]
                match_odds["bookmakers"]["b365"]["spread_away_odds"] = current["b365_aha"]

            # O/U
            if current.get("b365_over") and current.get("b365_under"):
                match_odds["bookmakers"]["b365"]["total_line"] = 2.5
                match_odds["bookmakers"]["b365"]["total_over"] = current["b365_over"]
                match_odds["bookmakers"]["b365"]["total_under"] = current["b365_under"]

            # Detect edges
            edges = detector.detect_all(
                fixture_id=0,
                league=current["league"],
                home_team=home_team,
                away_team=away_team,
                model_result=model_result,
                match_odds=match_odds,
                team_stats_home=current,
                team_stats_away=current,
            )

            if not edges:
                training_matches.append(current)
                continue

            # Generate picks (one per match, highest edge)
            picks = pick_gen.generate_picks(edges, kickoff_utc=current["date"] + "T00:00:00Z")
            if not picks:
                training_matches.append(current)
                continue

            best = picks[0]

            # Determine CLV reference (Pinnacle closing odds)
            clv_ref = None
            pinnacle_odds_val = None
            if best.market_type == "moneyline":
                if "HOME" in best.prediction and current.get("pinnacle_h"):
                    clv_ref = current["pinnacle_h"]
                    pinnacle_odds_val = current["pinnacle_h"]
                elif "AWAY" in best.prediction and current.get("pinnacle_a"):
                    clv_ref = current["pinnacle_a"]
                    pinnacle_odds_val = current["pinnacle_a"]
                elif "DRAW" in best.prediction and current.get("pinnacle_d"):
                    clv_ref = current["pinnacle_d"]
                    pinnacle_odds_val = current["pinnacle_d"]
            elif best.market_type == "asian_handicap":
                if "HOME" in best.prediction and current.get("pinnacle_ahh"):
                    clv_ref = current["pinnacle_ahh"]
                    pinnacle_odds_val = current["pinnacle_ahh"]
                elif "AWAY" in best.prediction and current.get("pinnacle_aha"):
                    clv_ref = current["pinnacle_aha"]
                    pinnacle_odds_val = current["pinnacle_aha"]
            elif best.market_type == "over_under":
                if "OVER" in best.prediction and current.get("pinnacle_over"):
                    clv_ref = current["pinnacle_over"]
                    pinnacle_odds_val = current["pinnacle_over"]
                elif "UNDER" in best.prediction and current.get("pinnacle_under"):
                    clv_ref = current["pinnacle_under"]
                    pinnacle_odds_val = current["pinnacle_under"]

            # Create backtest pick
            fk = _fixture_key(current)
            signal_id = hashlib.sha256(
                (fk + best.market_type + "backtest-v1").encode()
            ).hexdigest()[:16]

            bp = BacktestPick(
                fixture_key=fk,
                date=current["date"],
                league=current["league"],
                home_team=home_team,
                away_team=away_team,
                market_type=best.market_type,
                prediction=best.prediction,
                model_probability=best.model_probability,
                fair_odds=best.fair_odds,
                market_odds=best.market_odds,
                edge_pct=best.edge_pct,
                confidence=best.confidence,
                verdict=best.verdict,
                reasoning=best.reasoning,
                clv_reference=clv_ref,
                fthg=current["fthg"],
                ftag=current["ftag"],
                ah_line=current.get("ah_line", 0.0),
                b365_odds=best.market_odds,
                pinnacle_odds=pinnacle_odds_val,
            )

            # Settle the pick
            _settle_backtest_pick(bp)
            league_picks.append(bp)

            # Add to training set for next iteration
            training_matches.append(current)

        all_picks.extend(league_picks)
        logger.info(
            f"[Backtester] {league}: {len(league_matches)} matches -> {len(league_picks)} picks"
        )

    return all_picks


def _settle_backtest_pick(pick: BacktestPick) -> None:
    """Settle a backtest pick in-place."""
    try:
        if pick.market_type == "moneyline":
            pred_side = pick.prediction.split("(")[0].strip()
            result, pnl = settle_moneyline(
                pick.fthg, pick.ftag, pred_side, pick.market_odds
            )
        elif pick.market_type == "over_under":
            pred_side = pick.prediction.split(" ")[0]
            result, pnl = settle_over_under(
                pick.fthg, pick.ftag, 2.5, pred_side, pick.market_odds
            )
        elif pick.market_type == "asian_handicap":
            result, pnl = settle_asian_handicap(
                pick.fthg, pick.ftag, pick.ah_line, pick.prediction, pick.market_odds
            )
        else:
            result, pnl = "UNKNOWN", 0.0

        pick.result = result
        pick.pnl = round(pnl, 4)

    except Exception as e:
        logger.error(f"[Backtester] Settlement error for {pick.fixture_key}: {e}")
        pick.result = "ERROR"
        pick.pnl = 0.0
