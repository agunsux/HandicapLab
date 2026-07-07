import pandas as pd
import numpy as np
from sklearn.metrics import brier_score_loss, log_loss
from duckdb_loader import load_canonical_data
from pathlib import Path

# Placeholder function for Elo calculation
def calculate_simple_elo(df, k=20, home_adv=100):
    # This is a naive implementation for the sake of the baseline
    # Returns home win probabilities
    return np.random.uniform(0.3, 0.7, len(df))

# Placeholder function for Poisson calculation
def calculate_poisson_implied(df):
    return np.random.uniform(0.3, 0.7, len(df))

def run_exp_000():
    print("Running EXP-000: Baseline Benchmark")
    df = load_canonical_data()
    
    if df.empty:
        print("No data available to run benchmark.")
        return
        
    # Drop rows without required odds or goals
    required_cols = ['odds_home', 'odds_draw', 'odds_away', 'home_goals', 'away_goals']
    missing_cols = [c for c in required_cols if c not in df.columns]
    
    if missing_cols:
        print(f"Dataset missing columns for baseline evaluation: {missing_cols}")
        print("Using mock odds & outcomes for pipeline validation.")
        # Mocking for architectural validation
        df['odds_home'] = np.random.uniform(1.5, 3.5, len(df))
        df['odds_draw'] = np.random.uniform(2.5, 4.5, len(df))
        df['odds_away'] = np.random.uniform(2.0, 5.0, len(df))
        df['home_goals'] = np.random.poisson(1.5, len(df))
        df['away_goals'] = np.random.poisson(1.1, len(df))
        
    # Create target variable (1 if Home Win, 0 otherwise)
    df['target_home_win'] = (df['home_goals'] > df['away_goals']).astype(int)
    
    # 1. Bookmaker Implied Probability Baseline
    # Convert odds to probability (naive, without overround removal)
    df['prob_home_bookie'] = 1 / df['odds_home']
    df['prob_draw_bookie'] = 1 / df['odds_draw']
    df['prob_away_bookie'] = 1 / df['odds_away']
    
    # Remove overround (margin) simply
    total_implied = df['prob_home_bookie'] + df['prob_draw_bookie'] + df['prob_away_bookie']
    df['prob_home_bookie_true'] = df['prob_home_bookie'] / total_implied
    
    # 2. Simple Elo Baseline
    df['prob_home_elo'] = calculate_simple_elo(df)
    
    # 3. Poisson Baseline
    df['prob_home_poisson'] = calculate_poisson_implied(df)
    
    # Evaluation
    metrics = []
    models = {
        'Bookmaker Implied': 'prob_home_bookie_true',
        'Simple Elo': 'prob_home_elo',
        'Poisson': 'prob_home_poisson'
    }
    
    for name, col in models.items():
        try:
            brier = brier_score_loss(df['target_home_win'], df[col])
            ll = log_loss(df['target_home_win'], df[col])
            metrics.append({
                'Model': name,
                'Brier Score': round(brier, 4),
                'Log Loss': round(ll, 4)
            })
        except Exception as e:
            print(f"Error evaluating {name}: {e}")
            
    results_df = pd.DataFrame(metrics)
    print("\n=== EXP-000 RESULTS ===")
    print(results_df.to_string(index=False))
    
    # Write to a log
    log_dir = Path("experiments/exp_000")
    log_dir.mkdir(parents=True, exist_ok=True)
    results_df.to_csv(log_dir / "results.csv", index=False)
    print(f"\nResults saved to {log_dir}/results.csv")

if __name__ == "__main__":
    run_exp_000()
