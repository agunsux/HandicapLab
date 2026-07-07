import json
from pathlib import Path
from typing import List, Dict, Tuple
import pandas as pd
from datetime import datetime

from .base import RegistryInterface
from .json_registry import JsonRegistry

class RegistryValidator:
    def __init__(self, registry: RegistryInterface):
        self.registry = registry
        self.unknown_teams = set()
        self.unknown_leagues = set()
        self.unknown_bookmakers = set()
        
        self.history_dir = Path(__file__).parent / "registry_history"
        self.history_dir.mkdir(parents=True, exist_ok=True)
        
        self.auto_accepted = []
        
        self.AUTO_ACCEPT_THRESHOLD = 0.985
        self.HUMAN_REVIEW_THRESHOLD = 0.95
        
    def _audit_log(self, raw_name: str, result_dict: Dict):
        log_entry = {
            "raw": raw_name,
            "matched": result_dict['canonical_name'],
            "confidence": result_dict['confidence'],
            "method": result_dict['method'],
            "accepted": True,
            "reviewed_by": None,
            "timestamp": datetime.utcnow().isoformat()
        }
        self.auto_accepted.append(log_entry)
        
    def _process_entity(self, provider_name: str, raw_name: str, result_dict: Dict, unknown_set: set):
        conf = result_dict.get('confidence', 0.0)
        if conf >= self.AUTO_ACCEPT_THRESHOLD:
            # Auto accept
            if result_dict.get('method') == 'rapidfuzz':
                self._audit_log(raw_name, result_dict)
            return True
        elif conf >= self.HUMAN_REVIEW_THRESHOLD:
            # Human review required
            unknown_set.add((provider_name, str(raw_name)))
            return False
        else:
            # Reject
            unknown_set.add((provider_name, str(raw_name)))
            return False

    def check_dataframe(self, df: pd.DataFrame, provider_name: str, 
                        team_cols: List[str] = ['home_team', 'away_team'], 
                        league_col: str = 'league',
                        bookmaker_cols: List[str] = None):
        """
        Scans a dataframe for unknown entities using confidence thresholds.
        """
        for col in team_cols:
            if col in df.columns:
                unique_teams = df[col].dropna().unique()
                for team in unique_teams:
                    res = self.registry.get_canonical_team_id(provider_name, str(team))
                    self._process_entity(provider_name, team, res, self.unknown_teams)
                        
        if league_col in df.columns:
            unique_leagues = df[league_col].dropna().unique()
            for league in unique_leagues:
                res = self.registry.get_canonical_league_id(provider_name, str(league))
                self._process_entity(provider_name, league, res, self.unknown_leagues)
                    
        if bookmaker_cols:
            for col in bookmaker_cols:
                if col in df.columns:
                    unique_bookies = df[col].dropna().unique()
                    for bookie in unique_bookies:
                        res = self.registry.get_canonical_bookmaker_id(provider_name, str(bookie))
                        self._process_entity(provider_name, bookie, res, self.unknown_bookmakers)
                            
        # Flush auto-accepted logs
        if self.auto_accepted:
            date_str = datetime.utcnow().strftime("%Y-%m-%d")
            hist_file = self.history_dir / f"{date_str}.json"
            
            existing = []
            if hist_file.exists():
                with open(hist_file, 'r', encoding='utf-8') as f:
                    existing = json.load(f)
            
            existing.extend(self.auto_accepted)
            with open(hist_file, 'w', encoding='utf-8') as f:
                json.dump(existing, f, indent=4)
                
            self.auto_accepted.clear()
                            
    def generate_review_file(self, output_dir: str = "."):
        """
        Creates registry_review.json with top candidates.
        """
        if not (self.unknown_teams or self.unknown_leagues or self.unknown_bookmakers):
            return False
            
        review_data = {
            "unknown_teams": [],
            "unknown_leagues": [],
            "unknown_bookmakers": []
        }
        
        # Only populate candidates if we actually have a JsonRegistry
        if isinstance(self.registry, JsonRegistry):
            for p, name in self.unknown_teams:
                cands = self.registry.get_candidates('team', name)
                review_data["unknown_teams"].append({"raw_name": name, "provider": p, "top_candidates": cands})
                
            for p, name in self.unknown_leagues:
                cands = self.registry.get_candidates('league', name)
                review_data["unknown_leagues"].append({"raw_name": name, "provider": p, "top_candidates": cands})
                
            for p, name in self.unknown_bookmakers:
                cands = self.registry.get_candidates('bookmaker', name)
                review_data["unknown_bookmakers"].append({"raw_name": name, "provider": p, "top_candidates": cands})
        
        out_path = Path(output_dir) / "registry_review.json"
        with open(out_path, 'w', encoding='utf-8') as f:
            json.dump(review_data, f, indent=4)
            
        print(f"\n[REGISTRY VALIDATOR] Entities need Human Review or are Unknown!")
        print(f"- Unknown Teams: {len(self.unknown_teams)}")
        print(f"- Unknown Leagues: {len(self.unknown_leagues)}")
        print(f"- Unknown Bookmakers: {len(self.unknown_bookmakers)}")
        print(f"Review required: Please check {out_path} and update the JSON registries.")
        return True
