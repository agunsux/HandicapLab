from abc import ABC, abstractmethod
import pandas as pd
from typing import Dict, Any

class BaseEngine(ABC):
    """
    Abstract Base Class for all Market Intelligence Engines.
    Enforces a modular, decoupled contract.
    """
    
    @abstractmethod
    def calculate(self, df: pd.DataFrame, **kwargs) -> Dict[str, Any]:
        """
        Takes a DataFrame of odds history and returns calculated metrics.
        """
        pass
    
    @abstractmethod
    def generate_report(self, metrics: Dict[str, Any], filepath: str):
        """
        Generates a markdown report summarizing the engine's findings.
        """
        pass
