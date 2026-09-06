"""
Root alias wrapper importing from python_engine.scraper.skoreroom_client
"""
import sys
from pathlib import Path

# Add python_engine to path
engine_path = Path(__file__).resolve().parent.parent / "python_engine"
if str(engine_path) not in sys.path:
    sys.path.insert(0, str(engine_path))

from python_engine.scraper.skoreroom_client import (  # noqa: F401
    API_URL_KEYWORDS,
    USER_AGENTS,
    ScrapedPayload,
    SkoreroomScraperClient,
)

__all__ = [
    "SkoreroomScraperClient",
    "ScrapedPayload",
    "USER_AGENTS",
    "API_URL_KEYWORDS",
]
