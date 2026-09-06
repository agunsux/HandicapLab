"""
HandicapLab - Archive Supabase Ingestion Service
=================================================
Manages persistent, idempotent UPSERT operations of scraped matches,
odds history, and match team stats into Supabase PostgreSQL tables.

Guarantees:
- Idempotency: Re-running scraper never produces duplicate match or odds rows.
- Foreign Key Integrity: Resolves matches.id UUID before inserting odds and stats.
- Batch Chunking: Prevents PostgREST payload limits and network timeouts.
- Asynchronous API: Wraps database operations to ensure non-blocking I/O.
"""

from __future__ import annotations

import asyncio
import logging
import os
from typing import Dict, List, Optional, Tuple

from dotenv import load_dotenv
from supabase import Client, create_client

from scraper.data_parser import ScrapedMatch, ScrapedMatchBundle, ScrapedOdds, ScrapedTeamStats

load_dotenv()
logger = logging.getLogger("HandicapLab.ArchiveIngestor")


class ArchiveIngestor:
    """Production Supabase client for archiving sports market intelligence."""

    def __init__(
        self,
        supabase_url: Optional[str] = None,
        supabase_key: Optional[str] = None,
        batch_size: int = 50,
    ):
        self.url = supabase_url or os.getenv("SUPABASE_URL")
        self.key = supabase_key or os.getenv("SUPABASE_SERVICE_KEY") or os.getenv("SUPABASE_KEY")
        self.batch_size = batch_size

        if self.url and self.key and self.url != "mock" and self.key != "mock":
            self.client: Optional[Client] = create_client(self.url, self.key)
            logger.info("Connected to Supabase at %s", self.url.split("//")[-1].split(".")[0])
        else:
            self.client = None
            logger.warning("Supabase credentials missing or 'mock'. Operating in DRY-RUN / Mock mode.")

    # -----------------------------------------------------------------
    # Batch Chunking Utility
    # -----------------------------------------------------------------
    @staticmethod
    def _chunk_list(items: list, size: int):
        for i in range(0, len(items), size):
            yield items[i : i + size]

    # -----------------------------------------------------------------
    # Ingestion Core Methods (Synchronous implementations)
    # -----------------------------------------------------------------

    def _sync_upsert_matches(self, matches: List[ScrapedMatch]) -> Dict[str, str]:
        """
        Upserts matches into the 'matches' table using 'source_fixture_id' or
        (home_team, away_team, kickoff) constraint.
        Returns a mapping of {source_fixture_id: match_uuid}.
        """
        if not matches:
            return {}

        fixture_to_uuid_map: Dict[str, str] = {}

        if not self.client:
            for idx, m in enumerate(matches):
                fixture_to_uuid_map[m.fixture_id] = f"mock-uuid-{idx:04d}"
            logger.info("[DRY RUN] Upserted %d matches into 'matches'", len(matches))
            return fixture_to_uuid_map

        rows = []
        for m in matches:
            rows.append({
                "source_fixture_id": m.fixture_id,
                "home_team": m.home_team,
                "away_team": m.away_team,
                "league": m.league,
                "kickoff": m.kickoff.isoformat(),
                "status": m.status,
                "home_goals": m.home_goals,
                "away_goals": m.away_goals,
                "ht_home_goals": m.ht_home_goals,
                "ht_away_goals": m.ht_away_goals,
                "updated_at": "now()",
            })

        for chunk in self._chunk_list(rows, self.batch_size):
            try:
                # Upsert on source_fixture_id to guarantee idempotency
                res = (
                    self.client.table("matches")
                    .upsert(chunk, on_conflict="source_fixture_id")
                    .execute()
                )
                if res.data:
                    for item in res.data:
                        src_id = item.get("source_fixture_id")
                        uid = item.get("id")
                        if src_id and uid:
                            fixture_to_uuid_map[src_id] = uid
            except Exception as e:
                logger.error("Failed to upsert matches batch: %s", e)
                # Fallback: Query existing matches to populate UUID map
                for r in chunk:
                    try:
                        q = (
                            self.client.table("matches")
                            .select("id, source_fixture_id")
                            .eq("source_fixture_id", r["source_fixture_id"])
                            .execute()
                        )
                        if q.data:
                            fixture_to_uuid_map[q.data[0]["source_fixture_id"]] = q.data[0]["id"]
                    except Exception:
                        pass

        logger.info("Successfully synced %d matches. UUID mapping populated.", len(fixture_to_uuid_map))
        return fixture_to_uuid_map

    def _sync_upsert_odds(
        self, odds_list: List[ScrapedOdds], fixture_uuid_map: Dict[str, str]
    ) -> int:
        """Upserts odds snapshots into 'odds_history' table."""
        if not odds_list:
            return 0

        if not self.client:
            logger.info("[DRY RUN] Upserted %d odds rows into 'odds_history'", len(odds_list))
            return len(odds_list)

        rows = []
        for o in odds_list:
            match_uuid = fixture_uuid_map.get(o.fixture_id)
            if not match_uuid:
                logger.debug("Skipping odds for fixture %s: Match UUID not found", o.fixture_id)
                continue

            # Determine price and selection based on market type
            price = o.home_odds or o.over_odds or 1.90
            selection = "home" if o.market_type in ("ah", "ml") else "over"

            rows.append({
                "match_id": match_uuid,
                "bookmaker": o.bookmaker,
                "market_type": o.market_type,
                "line": o.line,
                "selection": selection,
                "price": price,
                "home_odds": o.home_odds,
                "away_odds": o.away_odds,
                "draw_odds": o.draw_odds,
                "over_odds": o.over_odds,
                "under_odds": o.under_odds,
                "odds_stage": o.odds_stage,
                "recorded_at": o.recorded_at.isoformat(),
            })

        upserted_count = 0
        for chunk in self._chunk_list(rows, self.batch_size):
            try:
                res = (
                    self.client.table("odds_history")
                    .upsert(
                        chunk,
                        on_conflict="match_id,bookmaker,market_type,line,odds_stage,recorded_at",
                    )
                    .execute()
                )
                upserted_count += len(res.data) if res.data else len(chunk)
            except Exception as e:
                logger.error("Failed to upsert odds batch: %s", e)

        logger.info("Upserted %d odds history records.", upserted_count)
        return upserted_count

    def _sync_upsert_team_stats(
        self, stats_list: List[ScrapedTeamStats], fixture_uuid_map: Dict[str, str]
    ) -> int:
        """Upserts in-game pressure stats into 'match_team_stats' table."""
        if not stats_list:
            return 0

        if not self.client:
            logger.info("[DRY RUN] Upserted %d stats rows into 'match_team_stats'", len(stats_list))
            return len(stats_list)

        rows = []
        for s in stats_list:
            match_uuid = fixture_uuid_map.get(s.fixture_id)
            if not match_uuid:
                continue

            rows.append({
                "match_id": match_uuid,
                "team_name": s.team_name,
                "is_home": s.is_home,
                "xg": s.xg,
                "shots_on_target": s.shots_on_target,
                "total_shots": s.total_shots,
                "possession_pct": s.possession_pct,
                "corners": s.corners,
                "fouls": s.fouls,
                "dangerous_attacks": s.dangerous_attacks,
                "yellow_cards": s.yellow_cards,
                "red_cards": s.red_cards,
            })

        upserted_count = 0
        for chunk in self._chunk_list(rows, self.batch_size):
            try:
                res = (
                    self.client.table("match_team_stats")
                    .upsert(chunk, on_conflict="match_id,team_name")
                    .execute()
                )
                upserted_count += len(res.data) if res.data else len(chunk)
            except Exception as e:
                logger.error("Failed to upsert team stats batch: %s", e)

        logger.info("Upserted %d match team stats records.", upserted_count)
        return upserted_count

    # -----------------------------------------------------------------
    # Asynchronous Ingestion Wrappers
    # -----------------------------------------------------------------

    async def ingest_bundles(
        self, bundles: List[ScrapedMatchBundle]
    ) -> Tuple[int, int, int]:
        """
        Orchestrates full ingestion of match bundles into Supabase:
        1. Upserts Matches -> retrieves UUID map.
        2. Upserts Odds History with foreign key references.
        3. Upserts Match Team Stats for Pressure Index calculation.
        Returns: (matches_count, odds_count, stats_count)
        """
        if not bundles:
            return (0, 0, 0)

        all_matches = [b.match for b in bundles]
        all_odds = [odd for b in bundles for odd in b.odds]
        all_stats = [st for b in bundles for st in b.stats]

        logger.info(
            "Starting Supabase ingestion for %d matches, %d odds snapshots, %d team stats...",
            len(all_matches),
            len(all_odds),
            len(all_stats),
        )

        # 1. Matches Upsert
        fixture_uuid_map = await asyncio.to_thread(self._sync_upsert_matches, all_matches)

        # 2. Odds History Upsert
        odds_count = await asyncio.to_thread(self._sync_upsert_odds, all_odds, fixture_uuid_map)

        # 3. Match Team Stats Upsert
        stats_count = await asyncio.to_thread(
            self._sync_upsert_team_stats, all_stats, fixture_uuid_map
        )

        return (len(fixture_uuid_map), odds_count, stats_count)
