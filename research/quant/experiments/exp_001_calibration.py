import os
import sys
from pathlib import Path
import yaml
import numpy as np
import pandas as pd

# Add the quant root directory to path so we can import modules
sys.path.append(str(Path(__file__).resolve().parent.parent))

from data.duckdb_loader import load_canonical_data
from validation.walk_forward import walk_forward_split
from calibration.factory import get_calibrator
from evaluation.metrics import get_all_metrics
from evaluation.significance import paired_permutation_test, evaluate_decision_rule
from visualization.calibration_plot import generate_calibration_report
from tracking.logger import MLflowLogger

def generate_paper_review(metrics_df, significance_results, decision, output_path):
    report = f"""# Paper Review: EXP-001 (Pure Probability Calibration)

## Objective
To build a reusable calibration framework and evaluate if calibrating bookmaker implied probabilities improves LogLoss and ECE using walk-forward validation.

## Dataset
Canonical Feature Store (Mock Odds version for pipeline testing)

## Validation Strategy
Walk-Forward Validation

## Calibration Methods Evaluated
Platt Scaling, Isotonic Regression, internal Beta Calibration.

## Metrics (Averaged across Walk-Forward Folds)
{metrics_df.to_markdown()}

## Statistical Significance (vs Uncalibrated)
"""
    for method, p_val in significance_results.items():
        report += f"- **{method}**: p-value = {p_val:.4f}\n"

    report += f"""
## Decision
**{decision}**

## Next Experiment
Proceed to EXP-002: Simple Logistic Regression
"""
    with open(output_path, 'w') as f:
        f.write(report)


def run_experiment():
    config_path = Path(__file__).resolve().parent.parent / "config" / "exp_001.yaml"
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
        
    np.random.seed(config.get('seed', 42))
    
    logger = MLflowLogger("Probability Calibration")
    logger.start_run(config_path)
    
    df = load_canonical_data("../../data/silver")
    
    # Mock odds if missing or to ensure multi-year data for walk-forward
    if 'odds_home' not in df.columns or len(df['kickoff'].dt.year.unique()) < 2:
        print("Injecting multi-year mock data to validate walk-forward architecture...")
        dates = pd.date_range(start='2020-01-01', end='2024-12-31', periods=2000)
        df = pd.DataFrame({'kickoff': dates, 'match_id': range(2000)})
        df['odds_home'] = np.random.uniform(1.5, 3.5, len(df))
        df['odds_draw'] = np.random.uniform(2.5, 4.5, len(df))
        df['odds_away'] = np.random.uniform(2.0, 5.0, len(df))
        df['home_goals'] = np.random.poisson(1.5, len(df))
        df['away_goals'] = np.random.poisson(1.1, len(df))
        
    df['target_home_win'] = (df['home_goals'] > df['away_goals']).astype(int)
    
    total_implied = (1/df['odds_home']) + (1/df['odds_draw']) + (1/df['odds_away'])
    df['prob_home_bookie_true'] = (1/df['odds_home']) / total_implied
    
    methods = config['calibration']['methods']
    
    fold_metrics = []
    all_raw_predictions = []
    significance_results = {}
    
    for train_idx, test_idx, fold_name in walk_forward_split(df, time_col=config['validation']['time_column']):
        df_train = df.loc[train_idx]
        df_test = df.loc[test_idx]
        
        y_train = df_train['target_home_win'].values
        p_train_bookie = df_train['prob_home_bookie_true'].values
        
        y_test = df_test['target_home_win'].values
        p_test_bookie = df_test['prob_home_bookie_true'].values
        
        # Baseline Uncalibrated Metrics
        base_metrics = get_all_metrics(y_test, p_test_bookie)
        base_metrics['Method'] = 'Uncalibrated'
        base_metrics['Fold'] = fold_name
        fold_metrics.append(base_metrics)
        
        fold_predictions = pd.DataFrame({
            'match_id': df_test['match_id'] if 'match_id' in df_test.columns else df_test.index,
            'fold': fold_name,
            'actual_result': y_test,
            'bookmaker_probability': p_test_bookie,
            'Uncalibrated': p_test_bookie
        })
        
        # Train and evaluate calibrators
        for method in methods:
            calibrator = get_calibrator(method)
            calibrator.fit(p_train_bookie, y_train)
            
            p_test_calib = calibrator.predict_proba(p_test_bookie)
            
            calib_metrics = get_all_metrics(y_test, p_test_calib)
            calib_metrics['Method'] = method
            calib_metrics['Fold'] = fold_name
            fold_metrics.append(calib_metrics)
            
            fold_predictions[method] = p_test_calib
            
            # Significance vs uncalibrated (just last fold for simplicity or track overall)
            obs_diff, p_val = paired_permutation_test(y_test, p_test_bookie, p_test_calib)
            significance_results[method] = p_val
            
        all_raw_predictions.append(fold_predictions)

    # Aggregate
    df_metrics = pd.DataFrame(fold_metrics)
    avg_metrics = df_metrics.groupby('Method').mean(numeric_only=True).reset_index()
    
    print("=== EXP-001 Validation Results ===")
    print(avg_metrics.to_string(index=False))
    
    # Save artifacts
    artifacts_dir = Path("exp_001_artifacts")
    artifacts_dir.mkdir(exist_ok=True)
    
    # 1. Raw Predictions Parquet
    full_preds = pd.concat(all_raw_predictions)
    preds_path = artifacts_dir / "raw_predictions.parquet"
    full_preds.to_parquet(preds_path)
    logger.log_artifact(str(preds_path))
    
    # 2. Calibration Plot (using latest fold as example)
    dict_probs = {m: full_preds[full_preds['fold'] == fold_name][m].values for m in ['Uncalibrated'] + methods}
    y_true_plot = full_preds[full_preds['fold'] == fold_name]['actual_result'].values
    plot_path = artifacts_dir / "calibration_report.png"
    generate_calibration_report(y_true_plot, dict_probs, str(plot_path))
    logger.log_artifact(str(plot_path))
    
    # Decision Logic Example (using Isotonic)
    decision = "ADOPT Isotonic" if significance_results.get('isotonic', 1.0) < 0.05 else "REVISIT"
    
    # 3. Paper Review
    review_path = artifacts_dir / "Paper_Review.md"
    generate_paper_review(avg_metrics, significance_results, decision, str(review_path))
    logger.log_artifact(str(review_path))
    
    logger.end_run()
    print(f"\nArtifacts saved to {artifacts_dir}")

if __name__ == "__main__":
    run_experiment()
