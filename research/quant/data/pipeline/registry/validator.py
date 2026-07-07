import json
from pathlib import Path
from typing import List, Dict, Tuple
import pandas as pd
from .base import RegistryInterface

class RegistryValidator:
    def __init__(self, registry: RegistryInterface):
        self.registry = registry
        self.unknown_teams = set()
        self.unknown_leagues = set()
        self.unknown_bookmakers = set()
        
    def check_dataframe(self, df: pd.DataFrame, provider_name: str, 
                        team_cols: List[str] = ['home_team', 'away_team'], 
                        league_col: str = 'league',
                        bookmaker_cols: List[str] = None):
        """
        Scans a dataframe for unknown entities.
        """
        # Check teams
        for col in team_cols:
            if col in df.columns:
                unique_teams = df[col].dropna().unique()
                for team in unique_teams:
                    if not self.registry.get_canonical_team_id(provider_name, str(team)):
                        self.unknown_teams.add((provider_name, str(team)))
                        
        # Check leagues
        if league_col in df.columns:
            unique_leagues = df[league_col].dropna().unique()
            for league in unique_leagues:
                if not self.registry.get_canonical_league_id(provider_name, str(league)):
                    self.unknown_leagues.add((provider_name, str(league)))
                    
        # Check bookmakers
        if bookmaker_cols:
            for col in bookmaker_cols:
                if col in df.columns:
                    unique_bookies = df[col].dropna().unique()
                    for bookie in unique_bookies:
                        if not self.registry.get_canonical_bookmaker_id(provider_name, str(bookie)):
                            self.unknown_bookmakers.add((provider_name, str(bookie)))
                            
    def generate_review_file(self, output_dir: str = "."):
        """
        Creates registry_review.json if there are unknown entities.
        Returns True if review is required, False otherwise.
        """
        if not (self.unknown_teams or self.unknown_leagues or self.unknown_bookmakers):
            return False
            
        review_data = {
            "unknown_teams": [{"provider": p, "name": n} for p, n in self.unknown_teams],
            "unknown_leagues": [{"provider": p, "name": n} for p, n in self.unknown_leagues],
            "unknown_bookmakers": [{"provider": p, "name": n} for p, n in self.unknown_bookmakers]
        }
        
        out_path = Path(output_dir) / "registry_review.json"
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(review_data, f, indent=4)
            
        print(f"\n[REGISTRY VALIDATOR] Unknown Entities Found!")
        print(f"- Unknown Teams: {len(self.unknown_teams)}")
        print(f"- Unknown Leagues: {len(self.unknown_leagues)}")
        print(f"- Unknown Bookmakers: {len(self.unknown_bookmakers)}")
        print(f"Review required: Please check {out_path} and update the JSON registries.")
        return True
