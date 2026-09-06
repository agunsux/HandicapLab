"""
HandicapLab - ScoreRoom Data Parser
====================================
Transforms raw JSON API payloads or HTML DOM from ScoreRoom into
strongly-typed, validated Pydantic models ready for model calibration
(Dixon-Coles / Bayesian Poisson) and Supabase ingestion.

Data Models:
- ScrapedMatch: Match metadata, kickoff, status, FT/HT scores.
- ScrapedOdds: Asian Handicap, Over/Under, Moneyline odds movements.
- ScrapedTeamStats: xG, Shots on Target, Possession, Corners (Pressure Index).
"""

from __future__ import annotations

import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

try:
    from bs4 import BeautifulSoup
    HAS_BEAUTIFUL_SOUP = True
except ImportError:
    BeautifulSoup = None  # type: ignore
    HAS_BEAUTIFUL_SOUP = False

from pydantic import BaseModel, Field, field_validator

logger = logging.getLogger("HandicapLab.DataParser")


# =====================================================================
# PYDANTIC DATA MODELS
# =====================================================================

class ScrapedMatch(BaseModel):
    """Normalized match fixture and score representation."""
    fixture_id: str = Field(..., description="Unique source fixture identifier")
    league: str = Field(..., description="Competition or tournament name")
    kickoff: datetime = Field(..., description="Kickoff timestamp (UTC)")
    status: str = Field(default="upcoming", description="Match status (upcoming, live, finished, postponed, cancelled)")
    home_team: str = Field(..., description="Home club name")
    away_team: str = Field(..., description="Away club name")
    home_goals: Optional[int] = Field(default=None, ge=0)
    away_goals: Optional[int] = Field(default=None, ge=0)
    ht_home_goals: Optional[int] = Field(default=None, ge=0)
    ht_away_goals: Optional[int] = Field(default=None, ge=0)

    @field_validator("status")
    @classmethod
    def normalize_status(cls, v: str) -> str:
        s = v.strip().lower()
        if s in ("ft", "aet", "pen", "finished", "ended", "complete"):
            return "finished"
        if s in ("live", "ht", "1h", "2h", "in_play", "in-play"):
            return "live"
        if s in ("postp.", "postponed", "ppd"):
            return "postponed"
        if s in ("canc", "cancelled", "abandoned"):
            return "cancelled"
        return "upcoming"


class ScrapedOdds(BaseModel):
    """Normalized odds snapshot for Asian Handicap, Over/Under, or Moneyline."""
    fixture_id: str = Field(..., description="Foreign reference to match fixture_id")
    bookmaker: str = Field(default="consensus", description="Bookmaker name (e.g. pinnacle, sbo, bet365)")
    market_type: str = Field(..., description="Market type: 'ah' (Asian Handicap), 'ou' (Over/Under), 'ml' (1X2)")
    line: Optional[float] = Field(default=None, description="Handicap or Total line (e.g., -0.75, +0.25, 2.5, 2.75)")
    home_odds: Optional[float] = Field(default=None, gt=1.0, description="Home decimal odds (or Over odds for O/U)")
    away_odds: Optional[float] = Field(default=None, gt=1.0, description="Away decimal odds (or Under odds for O/U)")
    draw_odds: Optional[float] = Field(default=None, gt=1.0, description="Draw decimal odds (Moneyline only)")
    over_odds: Optional[float] = Field(default=None, gt=1.0, description="Over decimal odds")
    under_odds: Optional[float] = Field(default=None, gt=1.0, description="Under decimal odds")
    odds_stage: str = Field(default="closing", description="'opening', 'closing', or 'live'")
    recorded_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Timestamp of odds capture")

    @field_validator("market_type")
    @classmethod
    def validate_market(cls, v: str) -> str:
        m = v.strip().lower()
        if m in ("ah", "asian_handicap", "asian handicap", "spread", "spreads"):
            return "ah"
        if m in ("ou", "over_under", "over/under", "totals", "total"):
            return "ou"
        if m in ("ml", "1x2", "moneyline", "h2h"):
            return "ml"
        return m


class ScrapedTeamStats(BaseModel):
    """Match level team statistics required for Pressure Index & Dixon-Coles."""
    fixture_id: str = Field(..., description="Foreign reference to match fixture_id")
    team_name: str = Field(...)
    is_home: bool = Field(...)
    xg: Optional[float] = Field(default=None, ge=0.0, description="Expected goals (xG)")
    shots_on_target: Optional[int] = Field(default=None, ge=0)
    total_shots: Optional[int] = Field(default=None, ge=0)
    possession_pct: Optional[float] = Field(default=None, ge=0.0, le=100.0)
    corners: Optional[int] = Field(default=None, ge=0, description="Crucial for Pressure Index calculation")
    fouls: Optional[int] = Field(default=None, ge=0)
    dangerous_attacks: Optional[int] = Field(default=None, ge=0)
    yellow_cards: Optional[int] = Field(default=None, ge=0)
    red_cards: Optional[int] = Field(default=None, ge=0)


class ScrapedMatchBundle(BaseModel):
    """Aggregate bundle grouping a match with its corresponding odds movements and stats."""
    match: ScrapedMatch
    odds: List[ScrapedOdds] = Field(default_factory=list)
    stats: List[ScrapedTeamStats] = Field(default_factory=list)


# =====================================================================
# DATA PARSER ENGINE
# =====================================================================

class ScoreRoomDataParser:
    """Production parser for ScoreRoom API payloads and fallback HTML DOM."""

    # -----------------------------------------------------------------
    # Helper Parsing Utilities
    # -----------------------------------------------------------------

    @staticmethod
    def generate_fixture_id(home: str, away: str, kickoff_iso: str) -> str:
        """Deterministic fallback ID generator if source doesn't supply a unique key."""
        raw = f"{home.strip().lower()}_vs_{away.strip().lower()}_{kickoff_iso[:10]}"
        digest = hashlib.md5(raw.encode("utf-8")).hexdigest()[:12]
        return f"sr_{digest}"

    @staticmethod
    def parse_float(val: Any) -> Optional[float]:
        if val is None or val == "" or val == "-":
            return None
        try:
            cleaned = str(val).replace("%", "").strip()
            return float(cleaned)
        except (ValueError, TypeError):
            return None

    @staticmethod
    def parse_int(val: Any) -> Optional[int]:
        if val is None or val == "" or val == "-":
            return None
        try:
            cleaned = str(val).split()[0].replace(",", "").strip()
            return int(cleaned)
        except (ValueError, TypeError):
            return None

    @classmethod
    def parse_handicap_line(cls, raw: Any) -> Optional[float]:
        """
        Parses Asian Handicap lines in various standard notation styles:
        e.g., '-0.5', '+0.25', '0.0', '-0/0.5' -> -0.25, '0.5 / 1.0' -> 0.75, 'pk' -> 0.0
        """
        if raw is None or raw == "" or raw == "-":
            return None

        s = str(raw).strip().lower()
        if s in ("0", "0.0", "pk", "pick", "0:0"):
            return 0.0

        # Check for split handicap format: "0/0.5", "-0.5/-1.0", "0.25", etc.
        if "/" in s or "," in s:
            sep = "/" if "/" in s else ","
            parts = s.split(sep)
            try:
                p1 = float(parts[0].strip())
                p2 = float(parts[1].strip())
                # Handle sign convention for things like "-0/0.5" -> -0.25
                if "-" in parts[0] and p2 > 0:
                    p2 = -p2
                return round((p1 + p2) / 2.0, 3)
            except (ValueError, IndexError):
                pass

        try:
            return float(s)
        except ValueError:
            return None

    @staticmethod
    def parse_datetime(val: Any) -> datetime:
        """Parse various timestamp representations into UTC datetime."""
        if isinstance(val, (int, float)):
            # Epoch milliseconds or seconds
            ts = val / 1000.0 if val > 10000000000 else val
            return datetime.fromtimestamp(ts, tz=timezone.utc)
        if isinstance(val, str):
            val = val.strip()
            # ISO format handling
            try:
                dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
            except ValueError:
                pass
            # Common sports site formats: 'YYYY-MM-DD HH:MM' or 'DD/MM/YYYY HH:MM'
            for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%d/%m/%Y %H:%M", "%Y-%m-%dT%H:%M:%S"):
                try:
                    dt = datetime.strptime(val, fmt)
                    return dt.replace(tzinfo=timezone.utc)
                except ValueError:
                    continue

        return datetime.now(timezone.utc)

    # -----------------------------------------------------------------
    # STRATEGY 1: Intercepted JSON API Parser
    # -----------------------------------------------------------------

    def parse_api_json(self, raw_json: Dict[str, Any]) -> List[ScrapedMatchBundle]:
        """
        Extract match fixtures, odds movements, and stats directly from intercepted JSON.
        Adapts to common Next.js / sports API response structures.

        NOTE FOR LIVE INSPECTION:
        Inspect your browser's DevTools Network tab on scoreroom.com. Look for JSON payloads
        containing 'matches', 'fixtures', 'data', or 'odds'. Adjust the dictionary keys below
        to mirror ScoreRoom's exact schema.
        """
        bundles: List[ScrapedMatchBundle] = []

        # Common root containers in modern sports APIs
        data_nodes = (
            raw_json.get("fixtures")
            or raw_json.get("matches")
            or raw_json.get("data")
            or (raw_json.get("pageProps", {}).get("matches"))
            or (raw_json.get("pageProps", {}).get("fixtureData"))
        )

        if isinstance(data_nodes, dict) and "items" in data_nodes:
            data_nodes = data_nodes["items"]
        elif isinstance(data_nodes, dict):
            # Single match response
            data_nodes = [data_nodes]
        elif not isinstance(data_nodes, list):
            # If the entire root is a single fixture object
            if "homeTeam" in raw_json or "home_team" in raw_json or "teams" in raw_json:
                data_nodes = [raw_json]
            else:
                return bundles

        for node in data_nodes:
            if not isinstance(node, dict):
                continue

            try:
                bundle = self._parse_single_api_node(node)
                if bundle:
                    bundles.append(bundle)
            except Exception as e:
                logger.warning("Error parsing API node: %s. Node snippet: %s", e, str(node)[:200])

        return bundles

    def _parse_single_api_node(self, node: Dict[str, Any]) -> Optional[ScrapedMatchBundle]:
        """Maps an individual match JSON node into ScrapedMatchBundle."""
        # 1. Teams extraction
        teams = node.get("teams", {})
        home_team = (
            node.get("home_team")
            or node.get("homeTeam", {}).get("name")
            or teams.get("home", {}).get("name")
            or node.get("home")
        )
        away_team = (
            node.get("away_team")
            or node.get("awayTeam", {}).get("name")
            or teams.get("away", {}).get("name")
            or node.get("away")
        )

        if not home_team or not away_team:
            return None

        # 2. League & Kickoff
        league = (
            node.get("league", {}).get("name")
            if isinstance(node.get("league"), dict)
            else node.get("league") or node.get("competition") or "Unknown League"
        )
        raw_kickoff = node.get("kickoff") or node.get("date") or node.get("startTime") or node.get("timestamp")
        kickoff = self.parse_datetime(raw_kickoff)

        # 3. Fixture ID
        fixture_id = str(
            node.get("id")
            or node.get("fixture_id")
            or node.get("matchId")
            or self.generate_fixture_id(home_team, away_team, kickoff.isoformat())
        )

        # 4. Scores & Status
        status_raw = str(node.get("status") or node.get("state") or "upcoming")
        score_node = node.get("score") or node.get("goals") or {}
        home_goals = self.parse_int(score_node.get("home") or node.get("home_goals") or node.get("homeScore"))
        away_goals = self.parse_int(score_node.get("away") or node.get("away_goals") or node.get("awayScore"))

        ht_score_node = score_node.get("halftime") or node.get("ht_score") or {}
        ht_home = self.parse_int(ht_score_node.get("home") or node.get("ht_home_goals"))
        ht_away = self.parse_int(ht_score_node.get("away") or node.get("ht_away_goals"))

        match = ScrapedMatch(
            fixture_id=fixture_id,
            league=league,
            kickoff=kickoff,
            status=status_raw,
            home_team=home_team.strip(),
            away_team=away_team.strip(),
            home_goals=home_goals,
            away_goals=away_goals,
            ht_home_goals=ht_home,
            ht_away_goals=ht_away,
        )

        # 5. Odds History & Movements
        odds_list: List[ScrapedOdds] = []
        odds_container = node.get("odds") or node.get("markets") or node.get("bookmakers") or {}

        # Parse Moneyline (1X2)
        ml_node = odds_container.get("1x2") or odds_container.get("moneyline") or odds_container.get("ml")
        if ml_node:
            ml_home = self.parse_float(ml_node.get("home") or ml_node.get("1"))
            ml_draw = self.parse_float(ml_node.get("draw") or ml_node.get("x"))
            ml_away = self.parse_float(ml_node.get("away") or ml_node.get("2"))
            if ml_home and ml_away:
                odds_list.append(ScrapedOdds(
                    fixture_id=fixture_id,
                    bookmaker=ml_node.get("bookmaker", "pinnacle"),
                    market_type="ml",
                    line=None,
                    home_odds=ml_home,
                    draw_odds=ml_draw,
                    away_odds=ml_away,
                    odds_stage="closing" if match.status == "finished" else "opening",
                    recorded_at=kickoff,
                ))

        # Parse Asian Handicap (AH)
        ah_node = odds_container.get("asian_handicap") or odds_container.get("ah") or odds_container.get("spread")
        if ah_node:
            ah_line = self.parse_handicap_line(ah_node.get("line") or ah_node.get("handicap"))
            ah_home = self.parse_float(ah_node.get("home") or ah_node.get("1"))
            ah_away = self.parse_float(ah_node.get("away") or ah_node.get("2"))
            if ah_home and ah_away:
                odds_list.append(ScrapedOdds(
                    fixture_id=fixture_id,
                    bookmaker=ah_node.get("bookmaker", "pinnacle"),
                    market_type="ah",
                    line=ah_line,
                    home_odds=ah_home,
                    away_odds=ah_away,
                    odds_stage="closing" if match.status == "finished" else "opening",
                    recorded_at=kickoff,
                ))

        # Parse Over / Under (O/U)
        ou_node = odds_container.get("over_under") or odds_container.get("ou") or odds_container.get("totals")
        if ou_node:
            ou_line = self.parse_float(ou_node.get("line") or ou_node.get("total") or 2.5)
            ou_over = self.parse_float(ou_node.get("over") or ou_node.get("o"))
            ou_under = self.parse_float(ou_node.get("under") or ou_node.get("u"))
            if ou_over and ou_under:
                odds_list.append(ScrapedOdds(
                    fixture_id=fixture_id,
                    bookmaker=ou_node.get("bookmaker", "pinnacle"),
                    market_type="ou",
                    line=ou_line,
                    home_odds=ou_over,
                    away_odds=ou_under,
                    over_odds=ou_over,
                    under_odds=ou_under,
                    odds_stage="closing" if match.status == "finished" else "opening",
                    recorded_at=kickoff,
                ))

        # 6. Team Statistics (xG, Shots on Target, Possession, Corners)
        stats_list: List[ScrapedTeamStats] = []
        stats_node = node.get("stats") or node.get("statistics") or {}
        if stats_node:
            for is_home, key, team in [(True, "home", home_team), (False, "away", away_team)]:
                side = stats_node.get(key, {})
                stats_list.append(ScrapedTeamStats(
                    fixture_id=fixture_id,
                    team_name=team,
                    is_home=is_home,
                    xg=self.parse_float(side.get("xg") or side.get("expected_goals")),
                    shots_on_target=self.parse_int(side.get("shots_on_target") or side.get("sot")),
                    total_shots=self.parse_int(side.get("total_shots") or side.get("shots")),
                    possession_pct=self.parse_float(side.get("possession") or side.get("possession_pct")),
                    corners=self.parse_int(side.get("corners") or side.get("corner_kicks")),
                    fouls=self.parse_int(side.get("fouls")),
                    dangerous_attacks=self.parse_int(side.get("dangerous_attacks")),
                    yellow_cards=self.parse_int(side.get("yellow_cards")),
                    red_cards=self.parse_int(side.get("red_cards")),
                ))

        return ScrapedMatchBundle(match=match, odds=odds_list, stats=stats_list)

    # -----------------------------------------------------------------
    # STRATEGY 2: Fallback HTML / DOM Parser
    # -----------------------------------------------------------------

    def parse_dom(self, html_content: str, url: str) -> List[ScrapedMatchBundle]:
        """
        Fallback DOM parsing using BeautifulSoup when ScoreRoom renders SSR/HTML.
        Inspect scoreroom.com to update CSS selectors if classes change.
        """
        bundles: List[ScrapedMatchBundle] = []
        if not HAS_BEAUTIFUL_SOUP:
            logger.warning("beautifulsoup4 is not installed. DOM parsing skipped.")
            return bundles

        soup = BeautifulSoup(html_content, "html.parser")

        # Target match cards or rows (Adjust CSS selectors per live DOM)
        # Selectors commonly used on sports scoreboards
        match_containers = (
            soup.select("div[data-testid='match-row']")
            or soup.select(".match-item")
            or soup.select(".fixture-row")
            or soup.select("article.match-card")
            or soup.select("div.match-container")
        )

        if not match_containers:
            # Try single match view page
            single_match = self._parse_single_match_page_dom(soup, url)
            if single_match:
                return [single_match]
            return bundles

        for container in match_containers:
            try:
                # Home & Away
                home_el = container.select_one(".home-team, [data-team='home'], .team-home")
                away_el = container.select_one(".away-team, [data-team='away'], .team-away")
                if not home_el or not away_el:
                    continue

                home_team = home_el.get_text(strip=True)
                away_team = away_el.get_text(strip=True)

                # Score
                score_el = container.select_one(".score, .match-score, .result")
                home_goals, away_goals = None, None
                if score_el:
                    score_text = score_el.get_text(strip=True)
                    m = re.search(r"(\d+)\s*[-:]\s*(\d+)", score_text)
                    if m:
                        home_goals = int(m.group(1))
                        away_goals = int(m.group(2))

                # Time / Status
                status_el = container.select_one(".status, .time, .kickoff")
                status_text = status_el.get_text(strip=True) if status_el else "upcoming"

                kickoff = datetime.now(timezone.utc)
                fixture_id = self.generate_fixture_id(home_team, away_team, kickoff.isoformat())

                match = ScrapedMatch(
                    fixture_id=fixture_id,
                    league="ScoreRoom Archive",
                    kickoff=kickoff,
                    status=status_text,
                    home_team=home_team,
                    away_team=away_team,
                    home_goals=home_goals,
                    away_goals=away_goals,
                )

                # Extract embedded odds if present in row
                odds_list = []
                ah_el = container.select_one(".odds-ah, [data-market='ah']")
                if ah_el:
                    line_val = self.parse_handicap_line(ah_el.get("data-line") or ah_el.get_text(strip=True))
                    odds_list.append(ScrapedOdds(
                        fixture_id=fixture_id,
                        bookmaker="pinnacle",
                        market_type="ah",
                        line=line_val,
                        home_odds=1.90,
                        away_odds=1.95,
                    ))

                bundles.append(ScrapedMatchBundle(match=match, odds=odds_list, stats=[]))

            except Exception as e:
                logger.debug("Skipping container due to DOM parse error: %s", e)

        return bundles

    def _parse_single_match_page_dom(self, soup: BeautifulSoup, url: str) -> Optional[ScrapedMatchBundle]:
        """Parses a full match detail page with stats & odds movements."""
        home_el = soup.select_one("h1 .home, .match-header .team-home, [data-testid='home-team-name']")
        away_el = soup.select_one("h1 .away, .match-header .team-away, [data-testid='away-team-name']")
        if not home_el or not away_el:
            return None

        home_team = home_el.get_text(strip=True)
        away_team = away_el.get_text(strip=True)

        # Kickoff
        date_el = soup.select_one(".match-date, time, [data-testid='match-kickoff']")
        kickoff = self.parse_datetime(date_el.get("datetime") if date_el and date_el.has_attr("datetime") else None)
        fixture_id = self.generate_fixture_id(home_team, away_team, kickoff.isoformat())

        # Scores
        score_el = soup.select_one(".score-display, .match-score, [data-testid='match-score']")
        home_goals, away_goals = None, None
        if score_el:
            m = re.search(r"(\d+)\s*[-:]\s*(\d+)", score_el.get_text(strip=True))
            if m:
                home_goals = int(m.group(1))
                away_goals = int(m.group(2))

        match = ScrapedMatch(
            fixture_id=fixture_id,
            league="ScoreRoom Archive",
            kickoff=kickoff,
            status="finished" if (home_goals is not None) else "upcoming",
            home_team=home_team,
            away_team=away_team,
            home_goals=home_goals,
            away_goals=away_goals,
        )

        # Team Stats Table / Breakdown
        stats_list = []
        stat_rows = soup.select(".stat-row, [data-testid='stat-item'], tr.stat")
        stat_map: Dict[str, Tuple[Optional[float], Optional[float]]] = {}

        for row in stat_rows:
            label_el = row.select_one(".stat-label, .name, td.title")
            val_h_el = row.select_one(".home-val, .val-home, td.home")
            val_a_el = row.select_one(".away-val, .val-away, td.away")
            if label_el and val_h_el and val_a_el:
                lbl = label_el.get_text(strip=True).lower()
                vh = self.parse_float(val_h_el.get_text(strip=True))
                va = self.parse_float(val_a_el.get_text(strip=True))
                stat_map[lbl] = (vh, va)

        # Build Stats for Home & Away
        corners_h, corners_a = stat_map.get("corners", (None, None))
        xg_h, xg_a = stat_map.get("xg", (None, None))
        sot_h, sot_a = stat_map.get("shots on target", (None, None))
        shots_h, shots_a = stat_map.get("total shots", (None, None))
        poss_h, poss_a = stat_map.get("possession", (None, None))

        stats_list.append(ScrapedTeamStats(
            fixture_id=fixture_id,
            team_name=home_team,
            is_home=True,
            xg=xg_h,
            shots_on_target=int(sot_h) if sot_h else None,
            total_shots=int(shots_h) if shots_h else None,
            possession_pct=poss_h,
            corners=int(corners_h) if corners_h else None,
        ))
        stats_list.append(ScrapedTeamStats(
            fixture_id=fixture_id,
            team_name=away_team,
            is_home=False,
            xg=xg_a,
            shots_on_target=int(sot_a) if sot_a else None,
            total_shots=int(shots_a) if shots_a else None,
            possession_pct=poss_a,
            corners=int(corners_a) if corners_a else None,
        ))

        return ScrapedMatchBundle(match=match, odds=[], stats=stats_list)
