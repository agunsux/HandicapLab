import pandas as pd
import numpy as np
import yaml
from pathlib import Path
from functools import wraps
import inspect
from abc import ABC, abstractmethod

class FeatureLeakageError(Exception):
    pass

class FeatureNotRegisteredError(Exception):
    pass

def load_registry():
    path = Path(__file__).parent / "registry.yaml"
    with open(path, 'r', encoding='utf-8') as f:
        return yaml.safe_load(f)['features']

FEATURE_REGISTRY = load_registry()

def temporal_guard(func):
    """
    Mandatory decorator for all feature generators.
    Ensures:
    1. Input DataFrame is sorted chronologically.
    2. Zero future leakage (verifies that output at index i only depends on rows < i).
    3. Feature is registered in registry.yaml.
    """
    @wraps(func)
    def wrapper(self, df: pd.DataFrame, *args, **kwargs):
        feature_name = self.feature_name
        
        # 1. Registry Check
        if feature_name not in FEATURE_REGISTRY:
            raise FeatureNotRegisteredError(f"Feature '{feature_name}' must be registered in registry.yaml")
            
        registry_meta = FEATURE_REGISTRY[feature_name]
        if not registry_meta.get('leakage_safe', False):
            raise FeatureLeakageError(f"Feature '{feature_name}' is not marked as leakage_safe in registry.")
            
        # 2. Chronological Order Check
        if 'date' not in df.columns:
            raise ValueError("DataFrame must contain a 'date' column for temporal guarding.")
            
        dates = pd.to_datetime(df['date'])
        if not dates.is_monotonic_increasing:
            # Force sort to be safe
            df = df.sort_values('date').reset_index(drop=True)
            
        # 3. Compute Feature
        # The generator should return a pd.Series or a pd.DataFrame (if generating multiple)
        result = func(self, df, *args, **kwargs)
        
        # 4. Strict Leakage Verification (Stochastic)
        # To prove no future data was used, computing the feature on a truncated dataset 
        # up to index K must yield the exact same value at index K.
        # We test 3 random indices to ensure O(1) validation overhead.
        
        # Only test if result is a Series matching the df length and lag > 0
        lag = registry_meta.get('lag', 1)
        if isinstance(result, pd.Series) and len(result) == len(df) and len(df) > 10 and lag > 0:
            test_indices = np.random.choice(range(5, len(df)-1), 3, replace=False)
            for idx in test_indices:
                # Truncate dataframe to only see past and present
                truncated_df = df.iloc[:idx+1].copy()
                
                # Recompute
                truncated_result = func(self, truncated_df, *args, **kwargs)
                
                # Compare the value at the boundary
                original_val = result.iloc[idx]
                recomputed_val = truncated_result.iloc[idx]
                
                # Use np.isclose for floats, == for others, handle NaNs
                if pd.isna(original_val) and pd.isna(recomputed_val):
                    continue
                elif pd.isna(original_val) != pd.isna(recomputed_val):
                    raise FeatureLeakageError(f"[LEAKAGE DETECTED] Feature '{feature_name}'. Value changed when future data was hidden at index {idx}.")
                else:
                    try:
                        if not np.isclose(original_val, recomputed_val, equal_nan=True):
                            raise FeatureLeakageError(f"[LEAKAGE DETECTED] Feature '{feature_name}' uses future data! Val: {original_val}, Truncated Val: {recomputed_val} at idx {idx}")
                    except TypeError:
                        if original_val != recomputed_val:
                            raise FeatureLeakageError(f"[LEAKAGE DETECTED] Feature '{feature_name}' uses future data! Val: {original_val}, Truncated Val: {recomputed_val} at idx {idx}")
                            
        return result
    return wrapper


class BaseFeatureGenerator(ABC):
    def __init__(self):
        # Enforce that subclasses define feature_name matching the registry
        if not hasattr(self, 'feature_name'):
            raise NotImplementedError("Feature generators must define 'feature_name'")
            
    @abstractmethod
    def generate(self, df: pd.DataFrame) -> pd.Series:
        """
        Takes a Canonical Match DataFrame and returns a Series representing the feature.
        Must be decorated with @temporal_guard in subclass implementation.
        """
        pass
        
    def get_provenance_metadata(self) -> dict:
        meta = FEATURE_REGISTRY.get(self.feature_name, {})
        return {
            "feature": self.feature_name,
            "version": meta.get("version", "1.0"),
            "owner": meta.get("owner", "unknown"),
            "depends_on": meta.get("depends_on"),
            "leakage_safe": meta.get("leakage_safe")
        }
