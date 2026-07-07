import pandas as pd
import numpy as np
from pathlib import Path

def generate_golden_dataset():
    np.random.seed(42)
    dates = pd.date_range(start='2020-01-01', periods=200, freq='D')
    df = pd.DataFrame({
        'match_id': range(200),
        'kickoff': dates,
        'status': 'FINISHED',
        'season': '2020',
        'competition_id': np.random.choice(['EPL', 'LaLiga'], 200),
        'odds_home': np.random.uniform(1.5, 3.5, 200),
        'odds_draw': np.random.uniform(2.5, 4.5, 200),
        'odds_away': np.random.uniform(2.0, 5.0, 200),
        'home_goals': np.random.poisson(1.5, 200),
        'away_goals': np.random.poisson(1.1, 200)
    })
    
    out_dir = Path(__file__).parent
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "golden_dataset.parquet"
    df.to_parquet(out_path)
    print(f"Golden dataset saved to {out_path}")

if __name__ == "__main__":
    generate_golden_dataset()
