import pandas as pd
from pathlib import Path

class PredictionArchive:
    """
    Archives raw predictions in Parquet format.
    Ensures that every experiment has its prediction history saved for further diagnostics.
    """
    
    def __init__(self, archive_path: str = "research/predictions"):
        self.archive_path = Path(archive_path)
        self.archive_path.mkdir(parents=True, exist_ok=True)
        
    def archive_predictions(self, experiment_id: str, predictions_df: pd.DataFrame) -> str:
        """
        Saves the predictions dataframe (match_id, time, market, prob, odds, label) as Parquet.
        """
        required_cols = {'match_id', 'prediction_time', 'market', 'probability', 'odds', 'label'}
        if not required_cols.issubset(predictions_df.columns):
            raise ValueError(f"Predictions DataFrame missing required columns: {required_cols - set(predictions_df.columns)}")
            
        file_path = self.archive_path / f"{experiment_id}_predictions.parquet"
        predictions_df.to_parquet(file_path)
        
        return str(file_path)
