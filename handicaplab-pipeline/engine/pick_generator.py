"""
Pick Generator
==============
Filters edges and generates actionable picks.

Rules:
- ONE pick per match (highest edge, avoid conflicting markets)
- Minimum confidence threshold
- Verdict system: LAYAK (edge>=5 & conf>=80), PANTAU (edge>=3 & conf>=70)
- Anomaly detection: skip if model prob >0.95 or <0.05
"""

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from config import MIN_CONFIDENCE
from engine.edge_detector import Edge

logger = logging.getLogger(__name__)


@dataclass
class Pick:
    """An actionable betting pick."""
    fixture_id: int
    league: str
    home_team: str
    away_team: str
    kickoff_utc: str
    market_type: str
    prediction: str
    model_probability: float
    fair_odds: float
    market_odds: float
    market_bookmaker: str
    edge_pct: float
    confidence: int
    verdict: str              # "LAYAK", "PANTAU", or skipped
    reasoning: str
    status: str = "PENDING"
    created_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


class PickGenerator:
    """
    Generates picks from detected edges.
    Ensures one pick per match (highest edge, no conflicting markets).
    """

    def __init__(self, min_confidence: int = MIN_CONFIDENCE):
        self.min_confidence = min_confidence

    def generate_picks(
        self,
        edges: List[Edge],
        kickoff_utc: str = "",
    ) -> List[Pick]:
        """
        Convert edges to picks, applying filtering rules.

        Args:
            edges: List of Edge objects from EdgeDetector
            kickoff_utc: Match kickoff time

        Returns: List of Pick objects (may be empty)
        """
        if not edges:
            return []

        # Group edges by fixture
        fixture_edges: Dict[int, List[Edge]] = {}
        for edge in edges:
            if edge.fixture_id not in fixture_edges:
                fixture_edges[edge.fixture_id] = []
            fixture_edges[edge.fixture_id].append(edge)

        picks = []
        for fixture_id, fixture_edges_list in fixture_edges.items():
            pick = self._select_best_pick(fixture_edges_list, kickoff_utc)
            if pick:
                picks.append(pick)

        logger.info(f"[PickGenerator] Generated {len(picks)} picks from {len(edges)} edges")
        return picks

    def _select_best_pick(
        self,
        edges: List[Edge],
        kickoff_utc: str,
    ) -> Optional[Pick]:
        """
        Select the best pick from multiple edges for the same match.

        Rules:
        1. Skip if model probability >0.95 or <0.05 (anomaly)
        2. Skip if confidence < min_confidence
        3. Sort by edge_pct descending
        4. Take highest edge, but avoid conflicting markets
           (e.g., don't pick both OVER and UNDER for same match)
        """
        # Filter by confidence and anomaly
        valid_edges = []
        for e in edges:
            if e.confidence < self.min_confidence:
                continue
            if e.model_probability > 0.95 or e.model_probability < 0.05:
                logger.debug(f"[PickGenerator] Skipping anomaly: prob={e.model_probability:.4f} for {e.prediction}")
                continue
            valid_edges.append(e)

        if not valid_edges:
            return None

        # Sort by edge_pct descending
        valid_edges.sort(key=lambda e: e.edge_pct, reverse=True)

        # Take the highest edge
        best = valid_edges[0]

        # Determine verdict
        verdict = self._determine_verdict(best.edge_pct, best.confidence)

        return Pick(
            fixture_id=best.fixture_id,
            league=best.league,
            home_team=best.home_team,
            away_team=best.away_team,
            kickoff_utc=kickoff_utc,
            market_type=best.market_type,
            prediction=best.prediction,
            model_probability=best.model_probability,
            fair_odds=best.fair_odds,
            market_odds=best.market_odds,
            market_bookmaker=best.market_bookmaker,
            edge_pct=best.edge_pct,
            confidence=best.confidence,
            verdict=verdict,
            reasoning=best.reasoning,
        )

    @staticmethod
    def _determine_verdict(edge_pct: float, confidence: int) -> str:
        """
        Determine pick verdict:
        - LAYAK: edge >= 5% AND confidence >= 80
        - PANTAU: edge >= 3% AND confidence >= 70
        - Otherwise: skipped (shouldn't reach here due to earlier filters)
        """
        if edge_pct >= 5.0 and confidence >= 80:
            return "LAYAK"
        elif edge_pct >= 3.0 and confidence >= 70:
            return "PANTAU"
        return "SKIP"
