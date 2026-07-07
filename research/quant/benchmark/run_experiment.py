import pandas as pd
import numpy as np
from pathlib import Path

from registry.tracker import ExperimentTracker
from registry.champion import ChampionRegistry
from registry.leaderboard import Leaderboard
from validation.walk_forward import walk_forward_split
from evaluation.calibration import calculate_brier_score
from evaluation.profitability import calculate_roi
from models.baselines import AlwaysBetHome, AlwaysBetFavourite
from models.logistic_regression import LogisticRegression
from models.lightgbm import LightGBM

def target_encoder(row):
    # 0 = Home, 1 = Draw, 2 = Away
    if row['home_goals_ft'] > row['away_goals_ft']:
        return 0
    elif row['home_goals_ft'] == row['away_goals_ft']:
        return 1
    return 2

def run_experiment(model, df: pd.DataFrame):
    tracker = ExperimentTracker()
    champ_reg = ChampionRegistry()
    lb = Leaderboard()
    
    exp_id = tracker.start_experiment()
    print(f"Starting {exp_id} with {model.name}...")
    
    # Target
    df = df.dropna(subset=['home_goals_ft', 'away_goals_ft']).copy()
    df['target'] = df.apply(target_encoder, axis=1)
    
    # We will do walk-forward validation and aggregate the predictions
    all_preds = []
    
    for train_df, test_df in walk_forward_split(df):
        train_dates = pd.to_datetime(train_df['date']).dt.year
        test_dates = pd.to_datetime(test_df['date']).dt.year
        print(f"Train: {train_dates.min()}-{train_dates.max()} | Test: {test_dates.min()}")
        
        y_train = train_df['target'].values
        y_test = test_df['target'].values
        
        model.fit(train_df, y_train)
        probs = model.predict_proba(test_df)
        
        test_df = test_df.copy()
        test_df['prob_home'] = probs[:, 0]
        test_df['prob_draw'] = probs[:, 1]
        test_df['prob_away'] = probs[:, 2]
        
        # Simple betting strategy for ROI (bet highest prob)
        test_df['bet_on'] = np.argmax(probs, axis=1)
        test_df['result'] = y_test
        
        all_preds.append(test_df)
        
    final_df = pd.concat(all_preds, ignore_index=True)
    
    # Evaluate
    y_true = final_df['result'].values
    y_prob = final_df[['prob_home', 'prob_draw', 'prob_away']].values
    
    brier = float(calculate_brier_score(y_true, y_prob))
    roi = float(calculate_roi(final_df))
    
    metrics = {
        "brier": float(brier),
        "roi": float(roi)
    }
    
    metadata = {
        "model": model.name,
        "dataset_version": "v1.0",
        "feature_version": "1.0",
        "validation": "walk_forward"
    }
    
    # Champion evaluation
    is_promoted, reason = champ_reg.evaluate_candidate(brier, roi)
    
    status = "SUCCESS" if is_promoted else "REJECTED"
    metadata["status"] = status
    metadata["champion"] = is_promoted
    
    # Log everything
    tracker.log_metadata(exp_id, metadata)
    tracker.log_metrics(exp_id, metrics)
    tracker.log_predictions(exp_id, final_df)
    
    decision = "KEEP" if is_promoted else "REJECT"
    tracker.update_research_note(exp_id, decision, reason)
    
    if is_promoted:
        champ_reg.promote_to_champion(exp_id, model.name, "v1.0", "v1.0", brier, roi)
        
    lb.generate_leaderboard()
    
    print(f"\nExperiment {exp_id} Finished.")
    print(f"Brier: {brier:.4f} | ROI: {roi:.2f}%")
    print(f"Decision: {decision} ({reason})")

if __name__ == "__main__":
    # Generate some dummy gold data since we don't have the real DB populated here
    # In reality this reads from gold/ml_dataset_v1.parquet
    dates = pd.date_range('2014-01-01', '2023-12-31', freq='D')
    df = pd.DataFrame({
        'date': dates,
        'home_goals_ft': np.random.randint(0, 4, size=len(dates)),
        'away_goals_ft': np.random.randint(0, 4, size=len(dates)),
        'odds_pinnacle_1': np.random.uniform(1.1, 3.5, size=len(dates)),
        'odds_pinnacle_x': np.random.uniform(2.5, 4.5, size=len(dates)),
        'odds_pinnacle_2': np.random.uniform(1.5, 5.0, size=len(dates)),
        'home_elo_pre': np.random.uniform(1400, 1600, size=len(dates)),
        'market_implied_prob_home': np.random.uniform(0.3, 0.7, size=len(dates))
    })
    
    # Run Baseline
    run_experiment(AlwaysBetFavourite(), df)
    
    # Run ML Model
    run_experiment(LogisticRegression(), df)
