import argparse
from pathlib import Path

from providers.fd_co_uk import FootballDataCoUkProvider
from registry.json_registry import JsonRegistry
from registry.validator import RegistryValidator
from normalizer import apply_match_uuid, normalize_odds
from validation import validate_canonical_dataframe
from store import save_to_feature_store
from quality import compute_data_quality_score
from report import generate_quality_report, generate_historical_coverage_report

def run_ingestion(download: bool = True):
    quant_dir = Path(__file__).resolve().parent.parent.parent
    raw_dir = quant_dir / "data" / "raw"
    silver_dir = quant_dir / "data" / "silver"
    registry_dir = quant_dir / "data" / "pipeline" / "registry" / "registry_data"
    
    provider = FootballDataCoUkProvider()
    
    if download:
        print("--- PHASE 1: DOWNLOAD RAW ---")
        provider.download_raw(str(raw_dir))
        
    print("\n--- PHASE 2: PARSE RAW ---")
    df_raw = provider.parse_to_raw_dataframe(str(raw_dir))
    print(f"Loaded {len(df_raw)} raw rows.")
    if df_raw.empty:
        return
        
    print("\n--- PHASE 3: REGISTRY & ENTITY RESOLUTION ---")
    registry = JsonRegistry(str(registry_dir))
    validator = RegistryValidator(registry)
    
    # Football-Data.co.uk uses HomeTeam, AwayTeam, Div
    df_raw = df_raw.rename(columns={
        "HomeTeam": "home_team",
        "AwayTeam": "away_team",
        "Div": "league",
        "Date": "date",
        "FTHG": "home_goals",
        "FTAG": "away_goals"
    })
    
    # We will map "B365H" -> odds_bet365_1 etc in normalization, 
    # but first let's validate entities
    validator.check_dataframe(df_raw, provider.provider_id, team_cols=['home_team', 'away_team'], league_col='league')
    
    if validator.generate_review_file(output_dir=str(quant_dir / "data" / "pipeline")):
        print("HALTING INGESTION: Please review unknown entities in registry_review.json")
        return
        
    # Map to Canonical IDs
    df_raw['home_team_id'] = df_raw['home_team'].apply(lambda x: registry.get_canonical_team_id(provider.provider_id, str(x)))
    df_raw['away_team_id'] = df_raw['away_team'].apply(lambda x: registry.get_canonical_team_id(provider.provider_id, str(x)))
    df_raw['league_id'] = df_raw['league'].apply(lambda x: registry.get_canonical_league_id(provider.provider_id, str(x)))
    df_raw['season'] = df_raw['fd_season_file']
    df_raw['status'] = "FINISHED" # historical data is finished
    
    # Set provider match ID as fallback
    df_raw['provider_id'] = provider.provider_id
    df_raw['provider_match_id'] = df_raw.index.astype(str)
    
    print("\n--- PHASE 4: NORMALIZATION ---")
    df_raw = apply_match_uuid(df_raw)
    
    # Map B365 to canonical odds_bet365
    if 'B365H' in df_raw.columns:
        df_raw['odds_bet365_1'] = df_raw['B365H']
        df_raw['odds_bet365_x'] = df_raw['B365D']
        df_raw['odds_bet365_2'] = df_raw['B365A']
        df_raw = normalize_odds(df_raw, 'bet365')
        
    print("\n--- PHASE 5: VALIDATION ---")
    # Expected core columns
    expected_cols = [
        "match_uuid", "provider_id", "provider_match_id",
        "league_id", "season", "date", "status",
        "home_team_id", "away_team_id", "home_goals", "away_goals"
    ]
    validate_canonical_dataframe(df_raw, expected_cols)
    
    # Select only relevant columns to avoid polluting feature store
    final_cols = expected_cols + [c for c in df_raw.columns if c.startswith('odds_') or c.startswith('implied_') or c.startswith('norm_prob_') or c.startswith('overround_')]
    df_final = df_raw[final_cols].copy()
    
    print("\n--- PHASE 6: FEATURE STORE SAVE ---")
    save_to_feature_store(df_final, str(silver_dir))
    
    print("\n--- PHASE 7: QUALITY & REPORTING ---")
    quality_data = compute_data_quality_score(df_final)
    generate_quality_report(quality_data, str(quant_dir / "docs"))
    generate_historical_coverage_report(df_final, str(quant_dir / "docs"))
    print(f"Overall Data Quality Score: {quality_data['overall_score']:.2f}")
    
    print("\nIngestion Complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-download", action="store_true")
    args = parser.parse_args()
    
    run_ingestion(download=not args.skip_download)
