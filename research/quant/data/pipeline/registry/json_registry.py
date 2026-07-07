import json
from pathlib import Path
from typing import Optional, Dict, Tuple
from rapidfuzz import fuzz, process

from .base import RegistryInterface

class JsonRegistry(RegistryInterface):
    def __init__(self, registry_dir: str = None):
        if registry_dir is None:
            self.registry_dir = Path(__file__).parent / "registry_data"
        else:
            self.registry_dir = Path(registry_dir)
            
        self.teams_db = self._load_json(self.registry_dir / "teams.json")
        self.leagues_db = self._load_json(self.registry_dir / "leagues.json")
        self.bookmakers_db = self._load_json(self.registry_dir / "bookmakers.json")
        
        self._team_lookup = self._build_lookup(self.teams_db)
        self._league_lookup = self._build_lookup(self.leagues_db)
        self._bookmaker_lookup = self._build_lookup(self.bookmakers_db)
        
    def _load_json(self, path: Path) -> Dict:
        if not path.exists():
            return {"version": "1.0.0", "entities": {}}
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)
            
    def _build_lookup(self, db: Dict) -> Dict[str, str]:
        # Mapping from normalized lower name -> canonical_id
        lookup = {}
        for entity_id, entity_data in db.get("entities", {}).items():
            canonical = entity_data.get("canonical_name", "").lower()
            if canonical:
                lookup[canonical] = entity_id
            for alias in entity_data.get("aliases", []):
                lookup[alias.lower()] = entity_id
        return lookup
        
    def _normalize(self, name: str) -> str:
        """Basic normalizations before mapping."""
        n = str(name).strip().lower()
        # Some quick global rules could be applied here
        n = n.replace(" utd", " united")
        n = n.replace(" fc", "")
        n = n.replace("m'gladbach", "borussia monchengladbach")
        return n.strip()
        
    def _fuzzy_match(self, raw_name: str, db: Dict, context: Dict = None) -> Tuple[str, str, float]:
        """
        Runs rapidfuzz against all known canonical names and aliases.
        Returns (canonical_id, canonical_name, confidence)
        """
        best_id = None
        best_name = None
        best_score = 0.0
        
        for entity_id, entity_data in db.get("entities", {}).items():
            # Check if context matches (e.g. Country/League)
            if context:
                if 'country' in context and 'country' in entity_data:
                    if context['country'].lower() != entity_data['country'].lower():
                        continue
                        
            candidates = [entity_data.get("canonical_name", "")] + entity_data.get("aliases", [])
            
            for cand in candidates:
                if not cand: continue
                # Calculate multiple scores
                s1 = fuzz.token_sort_ratio(raw_name, cand)
                s2 = fuzz.token_set_ratio(raw_name, cand)
                s3 = fuzz.WRatio(raw_name, cand)
                
                max_score = max(s1, s2, s3)
                if max_score > best_score:
                    best_score = max_score
                    best_id = entity_id
                    best_name = entity_data.get("canonical_name", "")
                    
        return best_id, best_name, (best_score / 100.0)
        
    def get_candidates(self, db_name: str, raw_name: str, context: Dict = None, top_k: int = 3) -> list:
        if db_name == 'team': db = self.teams_db
        elif db_name == 'league': db = self.leagues_db
        else: db = self.bookmakers_db
        
        norm_name = self._normalize(raw_name)
        results = []
        for entity_id, entity_data in db.get("entities", {}).items():
            candidates = [entity_data.get("canonical_name", "")] + entity_data.get("aliases", [])
            best_s = 0
            for cand in candidates:
                if not cand: continue
                s = max(fuzz.token_sort_ratio(norm_name, cand), fuzz.token_set_ratio(norm_name, cand), fuzz.WRatio(norm_name, cand))
                if s > best_s: best_s = s
            if best_s > 0:
                results.append({"name": entity_data.get("canonical_name", ""), "score": round(best_s, 2), "id": entity_id})
                
        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]
        
    def _resolve(self, lookup_map: Dict, db: Dict, raw_name: str, context: Dict = None) -> Dict:
        if not raw_name:
            return {"canonical_id": None, "canonical_name": None, "method": "none", "confidence": 0.0}
            
        original_lower = str(raw_name).strip().lower()
        
        # 1. Exact Match / Alias Lookup
        if original_lower in lookup_map:
            ent_id = lookup_map[original_lower]
            return {
                "canonical_id": ent_id,
                "canonical_name": db["entities"][ent_id]["canonical_name"],
                "method": "alias",
                "confidence": 1.0
            }
            
        # 2. Normalization Rules
        norm_name = self._normalize(original_lower)
        if norm_name in lookup_map:
            ent_id = lookup_map[norm_name]
            return {
                "canonical_id": ent_id,
                "canonical_name": db["entities"][ent_id]["canonical_name"],
                "method": "normalized",
                "confidence": 1.0
            }
            
        # 3. RapidFuzz
        # Pass normalized name to fuzzy matcher
        f_id, f_name, f_conf = self._fuzzy_match(norm_name, db, context)
        
        return {
            "canonical_id": f_id,
            "canonical_name": f_name,
            "method": "rapidfuzz",
            "confidence": f_conf
        }

    def get_canonical_team_id(self, provider_name: str, team_name: str, context: Dict = None) -> Dict:
        return self._resolve(self._team_lookup, self.teams_db, team_name, context)
        
    def get_canonical_league_id(self, provider_name: str, league_name: str, context: Dict = None) -> Dict:
        return self._resolve(self._league_lookup, self.leagues_db, league_name, context)
        
    def get_canonical_bookmaker_id(self, provider_name: str, bookmaker_name: str, context: Dict = None) -> Dict:
        return self._resolve(self._bookmaker_lookup, self.bookmakers_db, bookmaker_name, context)
        
    def get_team_metadata(self, team_id: str) -> Optional[Dict]:
        return self.teams_db.get("entities", {}).get(team_id)
        
    def get_league_metadata(self, league_id: str) -> Optional[Dict]:
        return self.leagues_db.get("entities", {}).get(league_id)
        
    def get_bookmaker_metadata(self, bookmaker_id: str) -> Optional[Dict]:
        return self.bookmakers_db.get("entities", {}).get(bookmaker_id)
