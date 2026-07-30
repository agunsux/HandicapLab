"""
Edge Detector
=============
Compares model fair odds against market odds to detect positive expected value.

For each market (AH, O/U, ML) and each bookmaker:
    fair = model.fair_odds(model_prob)
    edge_pct = ((fair / market_odds) - 1) * 100

If edge_pct >= MIN_EDGE_PCT, an Edge object is created with confidence score
and plain-language reasoning (Bahasa Indonesia).
"""

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from config import MIN_EDGE_PCT

logger = logging.getLogger(__name__)


@dataclass
class Edge:
    """A detected edge between model and market."""
    fixture_id: int
    league: str
    home_team: str
    away_team: str
    market_type: str          # "moneyline", "asian_handicap", "over_under"
    prediction: str           # e.g. "HOME", "AWAY", "OVER 2.5", "AH HOME -0.5"
    model_probability: float
    fair_odds: float
    market_odds: float
    market_bookmaker: str
    edge_pct: float
    confidence: int           # 0-100
    reasoning: str            # Bahasa Indonesia
    model_lambda_home: float = 0.0
    model_lambda_away: float = 0.0


class EdgeDetector:
    """
    Detects edges by comparing model probabilities to market odds.
    """

    def __init__(self, min_edge_pct: float = MIN_EDGE_PCT):
        self.min_edge_pct = min_edge_pct

    def detect_all(
        self,
        fixture_id: int,
        league: str,
        home_team: str,
        away_team: str,
        model_result: Dict[str, Any],
        match_odds: Dict[str, Any],
        team_stats_home: Optional[Dict[str, Any]] = None,
        team_stats_away: Optional[Dict[str, Any]] = None,
    ) -> List[Edge]:
        """
        Detect edges across all markets and bookmakers.

        Args:
            fixture_id: API-Football fixture ID
            league: League name
            home_team, away_team: Team names
            model_result: Output from DixonColesModel.predict()
            match_odds: Odds dict from OddsPapiFetcher (bookmakers key)
            team_stats_home/away: Optional team stats for form bonus

        Returns: list of Edge objects (may be empty)
        """
        edges = []

        for bm_key, bm_odds in match_odds.get("bookmakers", {}).items():
            # ── Moneyline ──────────────────────────────────────────────
            edges.extend(self._detect_ml_edges(
                fixture_id, league, home_team, away_team,
                model_result, bm_key, bm_odds,
                team_stats_home, team_stats_away,
            ))

            # ── Asian Handicap ─────────────────────────────────────────
            edges.extend(self._detect_ah_edges(
                fixture_id, league, home_team, away_team,
                model_result, bm_key, bm_odds,
                team_stats_home, team_stats_away,
            ))

            # ── Over/Under ─────────────────────────────────────────────
            edges.extend(self._detect_ou_edges(
                fixture_id, league, home_team, away_team,
                model_result, bm_key, bm_odds,
                team_stats_home, team_stats_away,
            ))

        return edges

    # ── Market-Specific Detection ──────────────────────────────────────

    def _detect_ml_edges(
        self, fixture_id, league, home_team, away_team,
        model_result, bm_key, bm_odds,
        stats_home, stats_away,
    ) -> List[Edge]:
        """Detect moneyline edges."""
        edges = []
        ml_home = bm_odds.get("ml_home")
        ml_draw = bm_odds.get("ml_draw")
        ml_away = bm_odds.get("ml_away")

        if not all([ml_home, ml_draw, ml_away]):
            return edges

        p_home = model_result["p_home_win"]
        p_draw = model_result["p_draw"]
        p_away = model_result["p_away_win"]

        # Home win
        fair_home = 1.0 / p_home if p_home > 0 else 999
        edge_home = ((fair_home / ml_home) - 1) * 100
        if edge_home >= self.min_edge_pct:
            conf = self._compute_confidence(edge_home, stats_home, stats_away)
            edges.append(Edge(
                fixture_id=fixture_id, league=league,
                home_team=home_team, away_team=away_team,
                market_type="moneyline", prediction=f"HOME ({home_team})",
                model_probability=round(p_home, 4),
                fair_odds=round(fair_home, 4),
                market_odds=ml_home,
                market_bookmaker=bm_key,
                edge_pct=round(edge_home, 2),
                confidence=conf,
                reasoning=self._build_reasoning(
                    "HOME", home_team, away_team, edge_home, conf,
                    model_result, "moneyline",
                ),
                model_lambda_home=model_result["lambda_home"],
                model_lambda_away=model_result["lambda_away"],
            ))

        # Draw
        fair_draw = 1.0 / p_draw if p_draw > 0 else 999
        edge_draw = ((fair_draw / ml_draw) - 1) * 100
        if edge_draw >= self.min_edge_pct:
            conf = self._compute_confidence(edge_draw, stats_home, stats_away)
            edges.append(Edge(
                fixture_id=fixture_id, league=league,
                home_team=home_team, away_team=away_team,
                market_type="moneyline", prediction="DRAW",
                model_probability=round(p_draw, 4),
                fair_odds=round(fair_draw, 4),
                market_odds=ml_draw,
                market_bookmaker=bm_key,
                edge_pct=round(edge_draw, 2),
                confidence=conf,
                reasoning=self._build_reasoning(
                    "DRAW", home_team, away_team, edge_draw, conf,
                    model_result, "moneyline",
                ),
                model_lambda_home=model_result["lambda_home"],
                model_lambda_away=model_result["lambda_away"],
            ))

        # Away win
        fair_away = 1.0 / p_away if p_away > 0 else 999
        edge_away = ((fair_away / ml_away) - 1) * 100
        if edge_away >= self.min_edge_pct:
            conf = self._compute_confidence(edge_away, stats_home, stats_away)
            edges.append(Edge(
                fixture_id=fixture_id, league=league,
                home_team=home_team, away_team=away_team,
                market_type="moneyline", prediction=f"AWAY ({away_team})",
                model_probability=round(p_away, 4),
                fair_odds=round(fair_away, 4),
                market_odds=ml_away,
                market_bookmaker=bm_key,
                edge_pct=round(edge_away, 2),
                confidence=conf,
                reasoning=self._build_reasoning(
                    "AWAY", home_team, away_team, edge_away, conf,
                    model_result, "moneyline",
                ),
                model_lambda_home=model_result["lambda_home"],
                model_lambda_away=model_result["lambda_away"],
            ))

        return edges

    def _detect_ah_edges(
        self, fixture_id, league, home_team, away_team,
        model_result, bm_key, bm_odds,
        stats_home, stats_away,
    ) -> List[Edge]:
        """Detect Asian Handicap edges."""
        edges = []
        spread_line = bm_odds.get("spread_line")
        spread_home = bm_odds.get("spread_home_odds")
        spread_away = bm_odds.get("spread_away_odds")

        if spread_line is None or spread_home is None:
            return edges

        # Home covers the spread
        line_key = str(spread_line)
        ah_probs = model_result.get("ah_probabilities", {})
        p_home_cover = ah_probs.get(line_key)

        if p_home_cover is not None and p_home_cover > 0:
            fair_home = 1.0 / p_home_cover
            edge_home = ((fair_home / spread_home) - 1) * 100
            if edge_home >= self.min_edge_pct:
                conf = self._compute_confidence(edge_home, stats_home, stats_away)
                edges.append(Edge(
                    fixture_id=fixture_id, league=league,
                    home_team=home_team, away_team=away_team,
                    market_type="asian_handicap",
                    prediction=f"AH HOME {spread_line}",
                    model_probability=round(p_home_cover, 4),
                    fair_odds=round(fair_home, 4),
                    market_odds=spread_home,
                    market_bookmaker=bm_key,
                    edge_pct=round(edge_home, 2),
                    confidence=conf,
                    reasoning=self._build_reasoning(
                        f"AH HOME {spread_line}", home_team, away_team,
                        edge_home, conf, model_result, "asian_handicap",
                    ),
                    model_lambda_home=model_result["lambda_home"],
                    model_lambda_away=model_result["lambda_away"],
                ))

        # Away covers (inverse)
        if spread_away is not None and p_home_cover is not None:
            p_away_cover = 1.0 - p_home_cover
            fair_away = 1.0 / p_away_cover if p_away_cover > 0 else 999
            edge_away = ((fair_away / spread_away) - 1) * 100
            if edge_away >= self.min_edge_pct:
                conf = self._compute_confidence(edge_away, stats_home, stats_away)
                edges.append(Edge(
                    fixture_id=fixture_id, league=league,
                    home_team=home_team, away_team=away_team,
                    market_type="asian_handicap",
                    prediction=f"AH AWAY {spread_line}",
                    model_probability=round(p_away_cover, 4),
                    fair_odds=round(fair_away, 4),
                    market_odds=spread_away,
                    market_bookmaker=bm_key,
                    edge_pct=round(edge_away, 2),
                    confidence=conf,
                    reasoning=self._build_reasoning(
                        f"AH AWAY {spread_line}", home_team, away_team,
                        edge_away, conf, model_result, "asian_handicap",
                    ),
                    model_lambda_home=model_result["lambda_home"],
                    model_lambda_away=model_result["lambda_away"],
                ))

        return edges

    def _detect_ou_edges(
        self, fixture_id, league, home_team, away_team,
        model_result, bm_key, bm_odds,
        stats_home, stats_away,
    ) -> List[Edge]:
        """Detect Over/Under edges."""
        edges = []
        total_line = bm_odds.get("total_line")
        total_over = bm_odds.get("total_over")
        total_under = bm_odds.get("total_under")

        if total_line is None or total_over is None or total_under is None:
            return edges

        p_over = model_result["p_over_25"]
        p_under = model_result["p_under_25"]

        # Over
        fair_over = 1.0 / p_over if p_over > 0 else 999
        edge_over = ((fair_over / total_over) - 1) * 100
        if edge_over >= self.min_edge_pct:
            conf = self._compute_confidence(edge_over, stats_home, stats_away)
            edges.append(Edge(
                fixture_id=fixture_id, league=league,
                home_team=home_team, away_team=away_team,
                market_type="over_under",
                prediction=f"OVER {total_line}",
                model_probability=round(p_over, 4),
                fair_odds=round(fair_over, 4),
                market_odds=total_over,
                market_bookmaker=bm_key,
                edge_pct=round(edge_over, 2),
                confidence=conf,
                reasoning=self._build_reasoning(
                    f"OVER {total_line}", home_team, away_team,
                    edge_over, conf, model_result, "over_under",
                ),
                model_lambda_home=model_result["lambda_home"],
                model_lambda_away=model_result["lambda_away"],
            ))

        # Under
        fair_under = 1.0 / p_under if p_under > 0 else 999
        edge_under = ((fair_under / total_under) - 1) * 100
        if edge_under >= self.min_edge_pct:
            conf = self._compute_confidence(edge_under, stats_home, stats_away)
            edges.append(Edge(
                fixture_id=fixture_id, league=league,
                home_team=home_team, away_team=away_team,
                market_type="over_under",
                prediction=f"UNDER {total_line}",
                model_probability=round(p_under, 4),
                fair_odds=round(fair_under, 4),
                market_odds=total_under,
                market_bookmaker=bm_key,
                edge_pct=round(edge_under, 2),
                confidence=conf,
                reasoning=self._build_reasoning(
                    f"UNDER {total_line}", home_team, away_team,
                    edge_under, conf, model_result, "over_under",
                ),
                model_lambda_home=model_result["lambda_home"],
                model_lambda_away=model_result["lambda_away"],
            ))

        return edges

    # ── Confidence & Reasoning ──────────────────────────────────────────

    @staticmethod
    def _compute_confidence(
        edge_pct: float,
        stats_home: Optional[Dict[str, Any]] = None,
        stats_away: Optional[Dict[str, Any]] = None,
    ) -> int:
        """
        Compute confidence score (0-100).

        Base: 50 + edge_pct * 5
        Form bonus: 0-15 (based on recent form)
        Sample bonus: 0-10 (based on matches played)
        """
        base = 50 + edge_pct * 5

        form_bonus = 0
        if stats_home and stats_away:
            home_form = stats_home.get("form_last_5", [])
            away_form = stats_away.get("form_last_5", [])
            home_wins = sum(1 for r in home_form if r == "W")
            away_losses = sum(1 for r in away_form if r == "L")
            form_bonus = min(15, (home_wins + away_losses) * 3)

        sample_bonus = 0
        if stats_home and stats_away:
            home_played = stats_home.get("matches_played_home", 0)
            away_played = stats_away.get("matches_played_away", 0)
            total = home_played + away_played
            sample_bonus = min(10, total // 2)

        confidence = int(min(95, base + form_bonus + sample_bonus))
        return max(0, confidence)

    @staticmethod
    def _build_reasoning(
        prediction: str,
        home_team: str,
        away_team: str,
        edge_pct: float,
        confidence: int,
        model_result: Dict[str, Any],
        market_type: str,
    ) -> str:
        """
        Build plain-language reasoning in Bahasa Indonesia.
        """
        lam_h = model_result["lambda_home"]
        lam_a = model_result["lambda_away"]
        p_home = model_result["p_home_win"] * 100
        p_draw = model_result["p_draw"] * 100
        p_away = model_result["p_away_win"] * 100

        lines = [
            f"Prediksi: {prediction}",
            f"Edge: {edge_pct:.1f}% | Confidence: {confidence}/100",
            f"xG Model: {home_team} {lam_h:.2f} — {lam_a:.2f} {away_team}",
            f"Peluang: {home_team} {p_home:.0f}% | Draw {p_draw:.0f}% | {away_team} {p_away:.0f}%",
        ]

        if market_type == "asian_handicap":
            lines.append("Analisis: Model mendeteksi mispricing pada garis Asian Handicap.")
        elif market_type == "over_under":
            total_xg = lam_h + lam_a
            lines.append(f"Total xG: {total_xg:.2f} — {'Over' if total_xg > 2.5 else 'Under'} 2.5 diunggulkan.")
        elif market_type == "moneyline":
            if "HOME" in prediction:
                lines.append(f"Analisis: {home_team} diunggulkan menang berdasarkan parameter Dixon-Coles.")
            elif "AWAY" in prediction:
                lines.append(f"Analisis: {away_team} memiliki nilai di laga tandang.")
            else:
                lines.append("Analisis: Model melihat peluang imbang di atas ekspektasi pasar.")

        return " | ".join(lines)
