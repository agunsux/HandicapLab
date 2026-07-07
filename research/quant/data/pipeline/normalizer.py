import pandas as pd
import hashlib
import numpy as np

def generate_match_uuid(row) -> str:
    """
    Generates a deterministic SHA256 match_uuid based on League, Season, Date, Home, Away.
    """
    # Use string concatenation
    # Format: LEAGUE_ID|SEASON|DATE|HOME_TEAM_ID|AWAY_TEAM_ID
    # We use Date instead of Kickoff here if Kickoff isn't fully precise, 
    # but theoretically Date + Home + Away + League is unique enough per season.
    key = f"{row.get('league_id', '')}|{row.get('season', '')}|{row.get('date', '')}|{row.get('home_team_id', '')}|{row.get('away_team_id', '')}"
    return hashlib.sha256(key.encode('utf-8')).hexdigest()

def apply_match_uuid(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    # We assume league_id, season, date, home_team_id, away_team_id are available
    df['match_uuid'] = df.apply(generate_match_uuid, axis=1)
    return df

def normalize_odds(df: pd.DataFrame, bookmaker: str) -> pd.DataFrame:
    """
    Given a dataframe with decimal odds for a bookmaker (e.g. odds_{bookmaker}_1),
    calculates implied probability, overround, and normalized probability.
    """
    df = df.copy()
    
    col_1 = f"odds_{bookmaker}_1"
    col_x = f"odds_{bookmaker}_x"
    col_2 = f"odds_{bookmaker}_2"
    
    if col_1 in df.columns and col_x in df.columns and col_2 in df.columns:
        # Calculate Implied Probabilities
        df[f"implied_{bookmaker}_1"] = 1.0 / df[col_1]
        df[f"implied_{bookmaker}_x"] = 1.0 / df[col_x]
        df[f"implied_{bookmaker}_2"] = 1.0 / df[col_2]
        
        # Calculate Overround (Vigorish)
        df[f"overround_{bookmaker}"] = (
            df[f"implied_{bookmaker}_1"] + 
            df[f"implied_{bookmaker}_x"] + 
            df[f"implied_{bookmaker}_2"]
        )
        
        # Calculate Normalized Probabilities
        df[f"norm_prob_{bookmaker}_1"] = df[f"implied_{bookmaker}_1"] / df[f"overround_{bookmaker}"]
        df[f"norm_prob_{bookmaker}_x"] = df[f"implied_{bookmaker}_x"] / df[f"overround_{bookmaker}"]
        df[f"norm_prob_{bookmaker}_2"] = df[f"implied_{bookmaker}_2"] / df[f"overround_{bookmaker}"]
        
    return df
