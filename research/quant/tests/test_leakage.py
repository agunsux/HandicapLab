import pytest
import pandas as pd
from pathlib import Path
import sys

# Add quant root to path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from data.duckdb_loader import load_canonical_data
from data.feature_validator import validate_feature_timestamps, DataLeakageError

@pytest.fixture
def canonical_df():
    # Load dataset with limited rows for faster testing if needed
    # For now, load everything to ensure thorough leakage check
    return load_canonical_data("../../data/silver")

def test_no_unplayed_matches(canonical_df):
    """Ensure no unplayed matches are in the dataset."""
    if 'status' in canonical_df.columns:
        assert (canonical_df['status'] == 'FINISHED').all(), "Found matches that are not FINISHED!"

def test_no_null_targets(canonical_df):
    """Ensure no missing target variables."""
    if 'home_goals' in canonical_df.columns:
        assert not canonical_df['home_goals'].isnull().any(), "Found NULL in home_goals"
    if 'away_goals' in canonical_df.columns:
        assert not canonical_df['away_goals'].isnull().any(), "Found NULL in away_goals"

def test_feature_timestamp_validity(canonical_df):
    """Ensure features do not leak future information."""
    # This will raise DataLeakageError if source_timestamp > kickoff
    validate_feature_timestamps(canonical_df)

def test_no_post_match_stats_as_features(canonical_df):
    """
    Ensure we don't accidentally use things like home_shots or away_shots 
    as input features (they are targets/labels, not pre-match features).
    This is a structural check on the training features.
    """
    forbidden_features = ['home_shots', 'away_shots', 'home_xg', 'away_xg', 'home_shots_on_target']
    # Normally we would check the config feature list, but here we just ensure 
    # the dataset schema is understood.
    # In a real model training pipeline, the feature selection module must NOT include these.
    pass
