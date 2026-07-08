import os
import pandas as pd
import glob

data_dir = "data/EPL"
csv_files = glob.glob(os.path.join(data_dir, "*.csv"))

print("--- Phase A: Dataset Audit (EPL Historical Data) ---")
print(f"Found {len(csv_files)} seasons in {data_dir}")

total_matches = 0
missing_data_summary = pd.DataFrame()

all_dfs = []

for file in sorted(csv_files):
    df = pd.read_csv(file)
    season_name = os.path.basename(file).replace('.csv', '')
    matches_in_season = len(df)
    total_matches += matches_in_season
    print(f"\nSeason: {season_name} - Matches: {matches_in_season}")
    
    # Check for critical columns
    columns = set(df.columns)
    print(f"Columns found: {len(columns)}")
    
    # Check for odds coverage
    has_b365 = 'B365H' in columns
    has_asian = 'B365AHH' in columns or 'AHh' in columns
    has_ou = 'B365>2.5' in columns or 'BbMx>2.5' in columns
    
    print(f"Moneyline Coverage: {'YES' if has_b365 else 'NO'}")
    print(f"Asian Handicap Coverage: {'YES' if has_asian else 'NO'}")
    print(f"Over/Under Coverage: {'YES' if has_ou else 'NO'}")

    all_dfs.append(df)

if all_dfs:
    combined = pd.concat(all_dfs, ignore_index=True)
    print(f"\nTotal Matches across all seasons: {len(combined)}")
    
    missing = combined.isnull().sum()
    print("\nTop Missing Columns:")
    print(missing[missing > 0].sort_values(ascending=False).head(10))
