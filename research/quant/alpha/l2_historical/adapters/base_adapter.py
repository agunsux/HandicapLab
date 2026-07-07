from abc import ABC, abstractmethod
import pandas as pd
from research.quant.alpha.l2_historical.adapters.dataset_contract import DatasetContract

class BaseAdapter(ABC):
    """
    Abstract Base Class for Data Adapters.
    Ensures that any data source is normalized into the DatasetContract format.
    """
    
    @abstractmethod
    def load_data(self, source_path: str, **kwargs) -> pd.DataFrame:
        """
        Loads data from the source and normalizes it to the contract schema.
        MUST return a DataFrame that passes DatasetContract.validate()
        """
        pass
        
    def get_validated_data(self, source_path: str, **kwargs) -> pd.DataFrame:
        """
        Loads and validates data.
        """
        df = self.load_data(source_path, **kwargs)
        DatasetContract.validate(df)
        return df
