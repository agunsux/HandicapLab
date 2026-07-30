"""
Supabase Client
===============
Handles all database operations for the pipeline.

Tables:
- daily_picks: Upserted picks from daily_fetch.py
- odds_snapshots: Append-only snapshots for CLV computation
- track_record: Settlement results and performance metrics
"""

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from supabase import create_client, Client

from config import SUPABASE_URL, SUPABASE_SERVICE_KEY
from engine.pick_generator import Pick

logger = logging.getLogger(__name__)


class SupabaseService:
    """
    Service layer for Supabase operations.
    Uses service_role key for backend-to-database access.
    """

    def __init__(self):
        if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
            raise ValueError(
                "Supabase credentials not configured. "
                "Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env"
            )
        self.client: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    # ── Daily Picks ──────────────────────────────────────────────────────

    def upsert_daily_picks(self, picks: List[Pick]) -> int:
        """
        Upsert picks into the daily_picks table.
        Uses fixture_id + market_type as the conflict key.

        Returns: number of upserted rows
        """
        if not picks:
            logger.info("[Supabase] No picks to upsert")
            return 0

        records = []
        for pick in picks:
            records.append({
                "fixture_id": pick.fixture_id,
                "league": pick.league,
                "home_team": pick.home_team,
                "away_team": pick.away_team,
                "kickoff_utc": pick.kickoff_utc,
                "market_type": pick.market_type,
                "prediction": pick.prediction,
                "model_probability": pick.model_probability,
                "fair_odds": pick.fair_odds,
                "market_odds": pick.market_odds,
                "market_bookmaker": pick.market_bookmaker,
                "edge_pct": pick.edge_pct,
                "confidence": pick.confidence,
                "verdict": pick.verdict,
                "reasoning": pick.reasoning,
                "status": pick.status,
                "created_at": pick.created_at,
            })

        try:
            response = self.client.table("daily_picks").upsert(
                records,
                on_conflict=["fixture_id", "market_type"],
            ).execute()

            count = len(response.data) if response.data else 0
            logger.info(f"[Supabase] Upserted {count} daily picks")
            return count

        except Exception as e:
            logger.error(f"[Supabase] Failed to upsert picks: {e}")
            raise

    # ── Odds Snapshots ───────────────────────────────────────────────────

    def save_odds_snapshot(
        self,
        snapshot_label: str,
        odds_data: List[Dict[str, Any]],
    ) -> int:
        """
        Save an odds snapshot for CLV computation.
        Append-only — never overwrite.

        Args:
            snapshot_label: "opening" or "closing"
            odds_data: List of match odds dicts from OddsPapiFetcher

        Returns: number of inserted rows
        """
        if not odds_data:
            logger.info("[Supabase] No odds data to snapshot")
            return 0

        timestamp = datetime.now(timezone.utc).isoformat()
        records = []
        for match in odds_data:
            records.append({
                "snapshot_label": snapshot_label,
                "snapshot_timestamp": timestamp,
                "fixture_key": match.get("fixture_key", ""),
                "home_team": match.get("home_team", ""),
                "away_team": match.get("away_team", ""),
                "league_id": match.get("league_id"),
                "league_name": match.get("league_name", ""),
                "commence_time": match.get("commence_time", ""),
                "bookmakers": match.get("bookmakers", {}),
            })

        try:
            response = self.client.table("odds_snapshots").insert(records).execute()
            count = len(response.data) if response.data else 0
            logger.info(f"[Supabase] Saved {count} odds snapshots ({snapshot_label})")
            return count

        except Exception as e:
            logger.error(f"[Supabase] Failed to save odds snapshot: {e}")
            raise

    # ── Settlement ───────────────────────────────────────────────────────

    def settle_pick(
        self,
        fixture_id: int,
        market_type: str,
        result: str,           # "WON", "LOST", "PUSH"
        actual_home_goals: int,
        actual_away_goals: int,
    ) -> bool:
        """
        Settle a pick with actual result.

        Returns: True if successful
        """
        try:
            response = self.client.table("daily_picks").update({
                "status": result,
                "actual_home_goals": actual_home_goals,
                "actual_away_goals": actual_away_goals,
                "settled_at": datetime.now(timezone.utc).isoformat(),
            }).eq("fixture_id", fixture_id).eq("market_type", market_type).execute()

            success = len(response.data) > 0
            if success:
                logger.info(f"[Supabase] Settled pick {fixture_id}/{market_type} → {result}")
            else:
                logger.warning(f"[Supabase] No pick found to settle: {fixture_id}/{market_type}")
            return success

        except Exception as e:
            logger.error(f"[Supabase] Failed to settle pick: {e}")
            return False

    def update_track_record(
        self,
        date: str,
        total_picks: int,
        won: int,
        lost: int,
        pushed: int,
        total_edge_pct: float,
    ) -> bool:
        """
        Update the daily track record.

        Args:
            date: Date string (YYYY-MM-DD)
            total_picks: Number of picks that day
            won/lost/pushed: Results breakdown
            total_edge_pct: Average edge % for the day
        """
        try:
            win_rate = (won / total_picks * 100) if total_picks > 0 else 0.0

            response = self.client.table("track_record").upsert({
                "date": date,
                "total_picks": total_picks,
                "won": won,
                "lost": lost,
                "pushed": pushed,
                "win_rate": round(win_rate, 2),
                "avg_edge_pct": round(total_edge_pct, 2),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }, on_conflict=["date"]).execute()

            success = len(response.data) > 0
            logger.info(f"[Supabase] Track record updated for {date}: {won}/{total_picks} wins ({win_rate:.1f}%)")
            return success

        except Exception as e:
            logger.error(f"[Supabase] Failed to update track record: {e}")
            return False

    # ── CLV ──────────────────────────────────────────────────────────────

    def compute_clv(self, fixture_id: int, market_type: str) -> Optional[float]:
        """
        Compute Closing Line Value for a pick.
        clv = (closing_odds / opening_odds - 1) * 100

        Returns: CLV % or None if data unavailable
        """
        try:
            # Get opening odds
            opening = self.client.table("odds_snapshots").select(
                "bookmakers"
            ).eq("fixture_key", str(fixture_id)).eq(
                "snapshot_label", "opening"
            ).limit(1).execute()

            # Get closing odds
            closing = self.client.table("odds_snapshots").select(
                "bookmakers"
            ).eq("fixture_key", str(fixture_id)).eq(
                "snapshot_label", "closing"
            ).limit(1).execute()

            if not opening.data or not closing.data:
                return None

            # Extract the relevant market odds
            opening_bm = opening.data[0].get("bookmakers", {})
            closing_bm = closing.data[0].get("bookmakers", {})

            # Find the best bookmaker match
            for bm_key in opening_bm:
                if bm_key in closing_bm:
                    opening_odds = opening_bm[bm_key].get("ml_home")
                    closing_odds = closing_bm[bm_key].get("ml_home")
                    if opening_odds and closing_odds:
                        clv = (closing_odds / opening_odds - 1) * 100
                        return round(clv, 2)

            return None

        except Exception as e:
            logger.error(f"[Supabase] Failed to compute CLV: {e}")
            return None
