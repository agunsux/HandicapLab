import pandas as pd

class DatasetContract:
    """
    Enforces a strict schema validation for historical datasets.
    Before any experiment can run, the dataset MUST pass this contract.
    """
    
    REQUIRED_COLUMNS = {
        'match_id': 'int64',        # or string, depending on normalization
        'league': 'object',
        'season': 'object',
        'kickoff_utc': 'datetime64[ns]',
        'bookmaker': 'object',
        'market': 'object',         # e.g., AH, OU, 1X2
        'selection': 'object',
        'odds': 'float64',
        'timestamp': 'datetime64[ns]',
        'handicap': 'float64',      # Can be NaN for ML
        'closing_flag': 'bool',
        'provider': 'object',
        'version': 'object'
    }

    @staticmethod
    def validate(df: pd.DataFrame) -> bool:
        """
        Validates the DataFrame against the strict schema.
        Raises ValueError if validation fails.
        """
        if df.empty:
            raise ValueError("Dataset is empty.")
            
        missing_cols = [col for col in DatasetContract.REQUIRED_COLUMNS if col not in df.columns]
        if missing_cols:
            raise ValueError(f"Dataset is missing required columns: {missing_cols}")
            
        # Basic type checking (relaxed for object types)
        for col, expected_type in DatasetContract.REQUIRED_COLUMNS.items():
            if expected_type == 'datetime64[ns]':
                if not pd.api.types.is_datetime64_any_dtype(df[col]):
                    raise TypeError(f"Column '{col}' must be datetime.")
            elif expected_type == 'float64':
                if not pd.api.types.is_float_dtype(df[col]) and not pd.api.types.is_integer_dtype(df[col]):
                    raise TypeError(f"Column '{col}' must be numeric.")
            elif expected_type == 'bool':
                if not pd.api.types.is_bool_dtype(df[col]):
                    raise TypeError(f"Column '{col}' must be boolean.")
                    
        return True
