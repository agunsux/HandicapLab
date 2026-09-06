"""
Root alias wrapper importing from python_engine.scraper.data_parser
"""
import sys
from pathlib import Path

# Add python_engine to path
engine_path = Path(__file__).resolve().parent.parent / "python_engine"
if str(engine_path) not in sys.path:
    sys.path.insert(0, str(engine_path))

from python_engine.scraper.data_parser import (  # noqa: F401
    ScoreRoomDataParser,
    ScrapedMatch,
    ScrapedMatchBundle,
    ScrapedOdds,
    ScrapedTeamStats,
)

__all__ = [
    "ScoreRoomDataParser",
    "ScrapedMatch",
    "ScrapedOdds",
    "ScrapedTeamStats",
    "ScrapedMatchBundle",
]
