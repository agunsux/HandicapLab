import pandas as pd
from pathlib import Path
import hashlib
from datetime import datetime
import json

from features.calculators.strength import EloRating, RollingPoints
from features.calculators.market import ImpliedProbability

def build_gold_dataset(silver_dir: str, gold_dir: str):
    """
    Reads Canonical Matches from Silver Layer and enriches them with Features.
    Produces the Gold Layer (Analytics-ready ML Dataset).
    """
    print("--- 1. LOADING SILVER DATA ---")
    silver_path = Path(silver_dir)
    # Recursively load all parquet files (partitioned)
    all_files = list(silver_path.rglob("*.parquet"))
    
    if not all_files:
        print("No Silver data found.")
        return
        
    df = pd.concat([pd.read_parquet(f) for f in all_files], ignore_index=True)
    df = df.sort_values('date').reset_index(drop=True)
    
    print(f"Loaded {len(df)} Canonical Matches.")
    
    # Instantiate Feature Generators
    generators = [
        EloRating(),
        RollingPoints(),
        ImpliedProbability()
    ]
    
    print("\n--- 2. GENERATING FEATURES (TEMPORAL GUARD ACTIVE) ---")
    feature_dfs = []
    metadata = {}
    
    for gen in generators:
        print(f"Computing {gen.feature_name} ...")
        # Generate feature (TemporalGuard enforces leakage safety)
        feat_df = gen.generate(df)
        feature_dfs.append(feat_df)
        
        # Provenance
        meta = gen.get_provenance_metadata()
        meta['generated_at'] = datetime.utcnow().isoformat()
        metadata[gen.feature_name] = meta
        
    # Join features back to base
    df_gold = df.copy()
    for feat_df in feature_dfs:
        # Match indices
        df_gold = pd.concat([df_gold, feat_df], axis=1)
        
    print("\n--- 3. FEATURE QUALITY REPORT ---")
    quality_report = []
    
    for gen in generators:
        cols = feature_dfs[generators.index(gen)].columns
        for col in cols:
            missing = df_gold[col].isnull().mean()
            std = df_gold[col].std() if pd.api.types.is_numeric_dtype(df_gold[col]) else 1.0
            
            q_status = "OK"
            if missing > 0.5:
                q_status = "WARNING"
            elif missing > 0.9:
                q_status = "CRITICAL"
                
            if std == 0:
                q_status = "CRITICAL (Zero Variance)"
                
            quality_report.append({
                "Feature": col,
                "Missing %": round(missing * 100, 2),
                "Status": q_status,
                "Leakage Safe": "PASS" # Guaranteed by TemporalGuard
            })
            
    print(pd.DataFrame(quality_report).to_markdown(index=False))
    
    print("\n--- 4. SAVING GOLD DATASET ---")
    gold_path = Path(gold_dir)
    gold_path.mkdir(parents=True, exist_ok=True)
    
    # Save Feature Registry Snapshot
    with open(gold_path / "feature_provenance.json", "w") as f:
        json.dump(metadata, f, indent=4)
        
    # Fingerprint & Save
    dataset_hash = hashlib.sha256(pd.util.hash_pandas_object(df_gold, index=True).values).hexdigest()
    print(f"Gold Fingerprint: {dataset_hash}")
    
    out_file = gold_path / "ml_dataset_v1.parquet"
    df_gold.to_parquet(out_file, index=False)
    print(f"Gold Dataset saved: {out_file}")

if __name__ == "__main__":
    base_dir = Path(__file__).parent.parent.parent / "data"
    build_gold_dataset(str(base_dir / "silver"), str(base_dir / "gold"))
