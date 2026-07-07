from abc import ABC, abstractmethod
import pandas as pd

class ProviderInterface(ABC):
    
    @property
    @abstractmethod
    def provider_id(self) -> str:
        """The internal string ID of the provider (e.g. 'football_data_co_uk')"""
        pass
        
    @abstractmethod
    def download_raw(self, output_dir: str):
        """
        Downloads the raw data from the provider's API/Site and saves it to output_dir.
        Must not mutate the data.
        """
        pass
        
    @abstractmethod
    def parse_to_raw_dataframe(self, raw_dir: str) -> pd.DataFrame:
        """
        Reads the immutable files in raw_dir and returns a single concatenated DataFrame.
        This DataFrame should have a standardized set of raw columns, but is not fully canonical yet.
        """
        pass
