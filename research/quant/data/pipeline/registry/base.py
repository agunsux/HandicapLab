from abc import ABC, abstractmethod
from typing import Optional, List, Dict

class RegistryInterface(ABC):
    
    @abstractmethod
    def get_canonical_team_id(self, provider_name: str, team_name: str) -> Optional[str]:
        """Resolves a raw team name to the internal canonical team ID."""
        pass
        
    @abstractmethod
    def get_canonical_league_id(self, provider_name: str, league_name: str) -> Optional[str]:
        """Resolves a raw league name to the internal canonical league ID."""
        pass
        
    @abstractmethod
    def get_canonical_bookmaker_id(self, provider_name: str, bookmaker_name: str) -> Optional[str]:
        """Resolves a raw bookmaker name to the internal canonical bookmaker ID."""
        pass
        
    @abstractmethod
    def get_team_metadata(self, team_id: str) -> Optional[Dict]:
        pass
        
    @abstractmethod
    def get_league_metadata(self, league_id: str) -> Optional[Dict]:
        pass
        
    @abstractmethod
    def get_bookmaker_metadata(self, bookmaker_id: str) -> Optional[Dict]:
        pass
