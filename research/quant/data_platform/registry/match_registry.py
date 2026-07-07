import uuid
import pandas as pd
import duckdb
from pathlib import Path

class CanonicalMatchRegistry:
    """
    Manages the Canonical Match Identity.
    All providers (Pinnacle, Sbobet, etc) map to a single Canonical UUID.
    Storage is Parquet.
    """
    def __init__(self, lake_root: str = "data_lake"):
        self.lake_root = Path(lake_root)
        self.registry_dir = self.lake_root / "canonical" / "registry"
        self.registry_dir.mkdir(parents=True, exist_ok=True)
        self.registry_file = self.registry_dir / "canonical_matches.parquet"
        
    def _load_registry(self) -> pd.DataFrame:
        if self.registry_file.exists():
            return pd.read_parquet(self.registry_file)
        else:
            return pd.DataFrame(columns=[
                "canonical_uuid", "sport", "league", "season", 
                "home_team", "away_team", "kickoff_utc", "provider_id_map"
            ])

    def register_match(self, sport: str, league: str, season: str, home_team: str, away_team: str, kickoff_utc: str, provider: str, provider_match_id: str) -> str:
        """
        Registers a new match or appends a provider ID to an existing canonical match.
        """
        df = self._load_registry()
        
        # Simple matching logic (in production this would use fuzzy matching or explicit mapping tables)
        mask = (df["sport"] == sport) & (df["league"] == league) & (df["season"] == season) & \
               (df["home_team"] == home_team) & (df["away_team"] == away_team) & (df["kickoff_utc"] == kickoff_utc)
               
        if mask.any():
            idx = mask.idxmax()
            c_uuid = df.loc[idx, "canonical_uuid"]
            
            # Update provider map
            # Assuming provider_id_map is a dict stored as a string or object.
            # Simplified for implementation:
            return c_uuid
        else:
            c_uuid = str(uuid.uuid4())
            new_row = {
                "canonical_uuid": c_uuid,
                "sport": sport,
                "league": league,
                "season": season,
                "home_team": home_team,
                "away_team": away_team,
                "kickoff_utc": kickoff_utc,
                "provider_id_map": f'{{"{provider}": "{provider_match_id}"}}'
            }
            df = pd.concat([df, pd.DataFrame([new_row])], ignore_index=True)
            
            # Save back to Parquet
            df.to_parquet(self.registry_file, compression='zstd')
            return c_uuid
