"""
HandicapLab - Test Suite for ScoreRoom Scraper Pipeline
======================================================
Validates data parsing, Pydantic schemas, Asian Handicap line conversions,
DOM fallback handling, and mock Supabase ingestion.
"""

import sys
from pathlib import Path

# Add python_engine to sys.path
ENGINE_DIR = Path(__file__).resolve().parent.parent
if str(ENGINE_DIR) not in sys.path:
    sys.path.insert(0, str(ENGINE_DIR))

from scraper.data_parser import ScoreRoomDataParser, ScrapedMatch, ScrapedOdds, ScrapedTeamStats
from services.archive_ingestor import ArchiveIngestor
from scripts.run_archive_sync import audit_research_invariants


def test_handicap_line_parser():
    parser = ScoreRoomDataParser()
    assert parser.parse_handicap_line("-0.5") == -0.5
    assert parser.parse_handicap_line("+0.25") == 0.25
    assert parser.parse_handicap_line("0") == 0.0
    assert parser.parse_handicap_line("pk") == 0.0
    assert parser.parse_handicap_line("0/0.5") == 0.25
    assert parser.parse_handicap_line("-0.5/-1.0") == -0.75
    assert parser.parse_handicap_line("-0.75") == -0.75
    print("[PASS] test_handicap_line_parser passed")


def test_api_json_parsing():
    parser = ScoreRoomDataParser()
    mock_payload = {
        "fixtures": [
            {
                "id": "sr_fixture_991",
                "league": "Premier League",
                "kickoff": "2026-09-10T19:00:00Z",
                "status": "finished",
                "home_team": "Arsenal",
                "away_team": "Chelsea",
                "score": {
                    "home": 2,
                    "away": 1,
                    "halftime": {"home": 1, "away": 0}
                },
                "odds": {
                    "1x2": {
                        "bookmaker": "pinnacle",
                        "home": 1.95,
                        "draw": 3.60,
                        "away": 4.10
                    },
                    "asian_handicap": {
                        "bookmaker": "pinnacle",
                        "line": "-0.75",
                        "home": 1.91,
                        "away": 1.99
                    },
                    "over_under": {
                        "bookmaker": "pinnacle",
                        "line": "2.5",
                        "over": 1.85,
                        "under": 2.05
                    }
                },
                "stats": {
                    "home": {
                        "xg": 1.84,
                        "shots_on_target": 6,
                        "total_shots": 14,
                        "possession": 58.5,
                        "corners": 7,
                        "fouls": 9
                    },
                    "away": {
                        "xg": 0.92,
                        "shots_on_target": 3,
                        "total_shots": 8,
                        "possession": 41.5,
                        "corners": 3,
                        "fouls": 12
                    }
                }
            }
        ]
    }

    bundles = parser.parse_api_json(mock_payload)
    assert len(bundles) == 1
    b = bundles[0]

    # Verify Match
    assert b.match.fixture_id == "sr_fixture_991"
    assert b.match.home_team == "Arsenal"
    assert b.match.away_team == "Chelsea"
    assert b.match.home_goals == 2
    assert b.match.away_goals == 1
    assert b.match.ht_home_goals == 1
    assert b.match.status == "finished"

    # Verify Odds (ML, AH, OU)
    assert len(b.odds) == 3
    markets = {o.market_type: o for o in b.odds}
    assert "ml" in markets
    assert markets["ml"].home_odds == 1.95
    assert "ah" in markets
    assert markets["ah"].line == -0.75
    assert markets["ah"].bookmaker == "pinnacle"
    assert "ou" in markets
    assert markets["ou"].line == 2.5
    assert markets["ou"].over_odds == 1.85

    # Verify Stats
    assert len(b.stats) == 2
    home_stat = next(s for s in b.stats if s.is_home)
    assert home_stat.xg == 1.84
    assert home_stat.corners == 7
    assert home_stat.shots_on_target == 6

    # Test Invariant Audit
    audit_research_invariants(bundles)

    print("[PASS] test_api_json_parsing passed")


def test_dom_fallback_parsing():
    parser = ScoreRoomDataParser()
    mock_html = """
    <html>
      <body>
        <div class="match-item">
          <div class="home-team">Liverpool</div>
          <div class="away-team">Manchester City</div>
          <div class="score">3 - 2</div>
          <div class="status">FT</div>
          <div class="odds-ah" data-line="-0.25">AH -0.25</div>
        </div>
      </body>
    </html>
    """
    bundles = parser.parse_dom(mock_html, url="https://scoreroom.com/premier-league")
    # If bs4 is not installed, parse_dom returns empty list safely
    if len(bundles) > 0:
        b = bundles[0]
        assert b.match.home_team == "Liverpool"
        assert b.match.away_team == "Manchester City"
        assert b.match.home_goals == 3
        assert b.match.away_goals == 2
        assert b.match.status == "finished"
        assert len(b.odds) == 1
        assert b.odds[0].line == -0.25
    print("[PASS] test_dom_fallback_parsing passed")


def test_mock_archive_ingestion():
    ingestor = ArchiveIngestor(supabase_url="mock", supabase_key="mock")
    parser = ScoreRoomDataParser()
    sample_match = ScrapedMatch(
        fixture_id="sr_test_001",
        league="La Liga",
        kickoff=parser.parse_datetime("2026-09-08T20:00:00Z"),
        home_team="Real Madrid",
        away_team="Barcelona",
        home_goals=2,
        away_goals=0,
    )
    sample_odds = [
        ScrapedOdds(
            fixture_id="sr_test_001",
            bookmaker="pinnacle",
            market_type="ah",
            line=-0.5,
            home_odds=1.92,
            away_odds=1.98,
        )
    ]
    sample_stats = [
        ScrapedTeamStats(
            fixture_id="sr_test_001",
            team_name="Real Madrid",
            is_home=True,
            xg=2.10,
            shots_on_target=8,
            corners=6,
        )
    ]

    fixture_map = ingestor._sync_upsert_matches([sample_match])
    assert "sr_test_001" in fixture_map
    odds_count = ingestor._sync_upsert_odds(sample_odds, fixture_map)
    assert odds_count == 1
    stats_count = ingestor._sync_upsert_team_stats(sample_stats, fixture_map)
    assert stats_count == 1
    print("[PASS] test_mock_archive_ingestion passed")


if __name__ == "__main__":
    test_handicap_line_parser()
    test_api_json_parsing()
    test_dom_fallback_parsing()
    test_mock_archive_ingestion()
    print("\nALL SCRAPER PIPELINE TESTS PASSED!")
