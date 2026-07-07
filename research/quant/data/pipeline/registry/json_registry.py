import json
from pathlib import Path
from typing import Optional, Dict

from .base import RegistryInterface

class JsonRegistry(RegistryInterface):
    def __init__(self, registry_dir: str = None):
        if registry_dir is None:
            # Default to the registry_data folder in this directory
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
        lookup = {}
        for entity_id, entity_data in db.get("entities", {}).items():
            # Index by canonical name
            canonical = entity_data.get("canonical_name", "").lower()
            if canonical:
                lookup[canonical] = entity_id
                
            # Index by aliases
            for alias in entity_data.get("aliases", []):
                lookup[alias.lower()] = entity_id
                
            # Index by provider mapping if explicit
            # Note: A real implementation might index provider-specific names
            # mapping: provider -> provider_name -> canonical_id
            # For simplicity, we just dump aliases in a flat lookup if they don't clash.
            
        return lookup
        
    def _resolve(self, lookup_map: Dict, name: str) -> Optional[str]:
        if not name:
            return None
        return lookup_map.get(str(name).strip().lower())

    def get_canonical_team_id(self, provider_name: str, team_name: str) -> Optional[str]:
        # For now, just global alias matching. 
        # In a strict implementation, provider_name could scope the lookup.
        return self._resolve(self._team_lookup, team_name)
        
    def get_canonical_league_id(self, provider_name: str, league_name: str) -> Optional[str]:
        return self._resolve(self._league_lookup, league_name)
        
    def get_canonical_bookmaker_id(self, provider_name: str, bookmaker_name: str) -> Optional[str]:
        return self._resolve(self._bookmaker_lookup, bookmaker_name)
        
    def get_team_metadata(self, team_id: str) -> Optional[Dict]:
        return self.teams_db.get("entities", {}).get(team_id)
        
    def get_league_metadata(self, league_id: str) -> Optional[Dict]:
        return self.leagues_db.get("entities", {}).get(league_id)
        
    def get_bookmaker_metadata(self, bookmaker_id: str) -> Optional[Dict]:
        return self.bookmakers_db.get("entities", {}).get(bookmaker_id)
