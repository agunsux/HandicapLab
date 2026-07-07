from dataclasses import dataclass
from typing import List, Dict, Optional

@dataclass
class CanonicalMatchSchema:
    """
    Defines the standard internal representation of a Match in HandicapLab.
    """
    match_uuid: str
    match_id: str
    date: str
    kickoff: str
    status: str
    
    league_id: str
    season: str
    
    home_team_id: str
    away_team_id: str
    
    home_goals: int
    away_goals: int
    
    # Bookmaker details can be flattened or nested. 
    # For a purely columnar parquet store, flattened is better.
    # The columns should follow: `odds_{bookmaker}_{market}_{selection}`
    
@dataclass
class CanonicalOddsSchema:
    bookmaker_id: str
    
    # 1X2 Market
    odds_1: Optional[float] = None
    odds_x: Optional[float] = None
    odds_2: Optional[float] = None
    
    # Asian Handicap Market
    ah_line: Optional[float] = None
    odds_ah_home: Optional[float] = None
    odds_ah_away: Optional[float] = None
    
    # Over/Under Market
    ou_line: Optional[float] = None
    odds_ou_over: Optional[float] = None
    odds_ou_under: Optional[float] = None
    
# Expected columns in the final Parquet
EXPECTED_COLUMNS = [
    "match_uuid", "provider_id", "provider_match_id",
    "league_id", "season", "date", "kickoff", "status",
    "home_team_id", "away_team_id", "home_goals", "away_goals"
]
