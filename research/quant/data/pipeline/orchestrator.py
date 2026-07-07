import argparse
from pathlib import Path
import hashlib
import time
import pandas as pd
from datetime import datetime

from providers.fd_co_uk import FootballDataCoUkProvider
from registry.json_registry import JsonRegistry
from registry.validator import RegistryValidator
from normalizer import apply_match_uuid, normalize_odds
from validation import validate_provider_schema, validate_business_rules, validate_statistical_rules
from store import save_to_feature_store
from quality import compute_data_quality_score
from report import generate_quality_report, generate_historical_coverage_report

def run_ingestion(download: bool = True, force: bool = False, season_filter: str = None, provider_filter: str = None):
    quant_dir = Path(__file__).resolve().parent.parent.parent
    bronze_dir = quant_dir / "data" / "bronze"
    silver_dir = quant_dir / "data" / "silver"
    registry_dir = quant_dir / "data" / "pipeline" / "registry" / "registry_data"
    
    start_time = time.time()
    
    # We could loop through a list of providers here. 
    providers = [FootballDataCoUkProvider()]
    if provider_filter:
        providers = [p for p in providers if p.provider_id == provider_filter]
        
    if not providers:
        print("No providers matched the filter.")
        return
        
    for provider in providers:
        print(f"\n======================================")
        print(f"RUNNING PIPELINE FOR: {provider.provider_id}")
        print(f"======================================")
        
        if download:
            print("--- PHASE 1: DOWNLOAD RAW (BRONZE) ---")
            # In a real implementation we would pass force and season to download_raw
            provider.download_raw(str(bronze_dir))
            
        print("\n--- PHASE 2: PARSE RAW ---")
        df_raw = provider.parse_to_raw_dataframe(str(bronze_dir))
        
        if season_filter:
            if 'fd_season_file' in df_raw.columns:
                df_raw = df_raw[df_raw['fd_season_file'] == season_filter].copy()
                
        print(f"Loaded {len(df_raw)} raw rows.")
        if df_raw.empty:
            continue
            
        # Provider Schema Drift Check
        validate_provider_schema(df_raw, provider.provider_id)
            
        print("\n--- PHASE 3: REGISTRY & ENTITY RESOLUTION ---")
        registry = JsonRegistry(str(registry_dir))
        validator = RegistryValidator(registry)
        
        df_mapped = df_raw.rename(columns={
            "HomeTeam": "home_team",
            "AwayTeam": "away_team",
            "Div": "league",
            "Date": "date",
            "FTHG": "home_goals",
            "FTAG": "away_goals"
        })
        
        validator.check_dataframe(df_mapped, provider.provider_id, team_cols=['home_team', 'away_team'], league_col='league')
        
        if validator.generate_review_file(output_dir=str(quant_dir / "data" / "pipeline")) and not force:
            print("HALTING INGESTION: Please review unknown entities in registry_review.json")
            return
            
        # Map IDs
        # We pass Context (league) to get_canonical_team_id
        df_mapped['home_team_id'] = df_mapped.apply(lambda r: registry.get_canonical_team_id(provider.provider_id, str(r['home_team']), {"league": r['league']}).get('canonical_id'), axis=1)
        df_mapped['away_team_id'] = df_mapped.apply(lambda r: registry.get_canonical_team_id(provider.provider_id, str(r['away_team']), {"league": r['league']}).get('canonical_id'), axis=1)
        df_mapped['league_id'] = df_mapped['league'].apply(lambda x: registry.get_canonical_league_id(provider.provider_id, str(x)).get('canonical_id'))
        df_mapped['season'] = df_mapped['fd_season_file']
        df_mapped['status'] = "FINISHED"
        df_mapped['provider_id'] = provider.provider_id
        df_mapped['provider_match_id'] = df_mapped.index.astype(str)
        
        print("\n--- PHASE 4: NORMALIZATION ---")
        df_mapped = apply_match_uuid(df_mapped)
        
        if 'B365H' in df_mapped.columns:
            df_mapped['odds_bet365_1'] = df_mapped['B365H']
            df_mapped['odds_bet365_x'] = df_mapped['B365D']
            df_mapped['odds_bet365_2'] = df_mapped['B365A']
            df_mapped = normalize_odds(df_mapped, 'bet365')
            
        print("\n--- PHASE 5: VALIDATION ---")
        expected_cols = [
            "match_uuid", "provider_id", "provider_match_id",
            "league_id", "season", "date", "status",
            "home_team_id", "away_team_id", "home_goals", "away_goals"
        ]
        
        # If force=True, we might want to bypass P0 checks or drop invalid rows
        if force:
            df_mapped = df_mapped.dropna(subset=['home_team_id', 'away_team_id'])
            
        # Tier 2: Business Rules
        validate_business_rules(df_mapped, expected_cols)
        
        # Tier 3: Statistical Validation
        validate_statistical_rules(df_mapped)
        
        final_cols = expected_cols + [c for c in df_mapped.columns if c.startswith('odds_') or c.startswith('implied_') or c.startswith('norm_prob_') or c.startswith('overround_')]
        df_final = df_mapped[final_cols].copy()
        
        print("\n--- PHASE 6: FEATURE STORE SAVE ---")
        save_to_feature_store(df_final, str(silver_dir))
        
        print("\n--- PHASE 7: QUALITY & REPORTING ---")
        quality_data = compute_data_quality_score(df_final)
        generate_quality_report(quality_data, str(quant_dir / "docs"))
        generate_historical_coverage_report(df_final, str(quant_dir / "docs"))
        print(f"Overall Data Quality Score: {quality_data['overall_score']:.2f}")
        
        # Ingestion Log
        print("\n--- PHASE 8: INGESTION LOG ---")
        dataset_hash = hashlib.sha256(pd.util.hash_pandas_object(df_final, index=True).values).hexdigest()
        duration = time.time() - start_time
        
        log_entry = {
            "timestamp": datetime.utcnow().isoformat(),
            "provider": provider.provider_id,
            "season": season_filter if season_filter else "ALL",
            "duration": round(duration, 2),
            "status": "SUCCESS",
            "dataset_hash": dataset_hash,
            "schema_version": "v1.0",
            "version": "1.0"
        }
        
        log_file = quant_dir / "data" / "ingestion_log.parquet"
        if log_file.exists():
            df_log = pd.read_parquet(log_file)
            df_log = pd.concat([df_log, pd.DataFrame([log_entry])], ignore_index=True)
        else:
            df_log = pd.DataFrame([log_entry])
            
        df_log.to_parquet(log_file, index=False)
        print(f"Ingestion logged. Dataset Hash: {dataset_hash}")
        
    print("\nIngestion Complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--skip-download", action="store_true")
    parser.add_argument("--force", action="store_true", help="Force ingestion even if unknown entities exist")
    parser.add_argument("--season", type=str, help="Filter to specific season (e.g. 1617)")
    parser.add_argument("--provider", type=str, help="Filter to specific provider ID")
    args = parser.parse_args()
    
    run_ingestion(download=not args.skip_download, force=args.force, season_filter=args.season, provider_filter=args.provider)
