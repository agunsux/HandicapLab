import os
import pandas as pd
import json
import glob

def find_datasets(base_path="."):
    datasets = []
    # Search for CSV, SQLite, JSON
    for root, dirs, files in os.walk(base_path):
        if "node_modules" in root or ".venv" in root or ".git" in root or ".next" in root:
            continue
        for file in files:
            if file.endswith('.csv') or file.endswith('.sqlite') or file.endswith('.db'):
                datasets.append(os.path.join(root, file))
    return datasets

def profile_csv(filepath):
    try:
        # Some CSVs from football-data might have encoding issues, latin1 is safer
        df = pd.read_csv(filepath, encoding='latin1', low_memory=False)
        
        rows, cols = df.shape
        columns = list(df.columns)
        
        # Missing values
        missing_counts = df.isnull().sum()
        missing_pct = (missing_counts / rows * 100).round(2).to_dict()
        
        # Duplicates
        duplicates = df.duplicated().sum()
        
        # Try to find date range
        date_range = "Unknown"
        date_col = next((c for c in columns if c.lower() in ['date', 'match_date', 'kickoff']), None)
        if date_col:
            try:
                dates = pd.to_datetime(df[date_col], dayfirst=True, errors='coerce').dropna()
                if not dates.empty:
                    date_range = f"{dates.min().strftime('%Y-%m-%d')} to {dates.max().strftime('%Y-%m-%d')}"
            except:
                pass
                
        # Estimate properties based on football-data.co.uk format
        competition = "Unknown"
        country = "Unknown"
        div_col = next((c for c in columns if c.lower() == 'div'), None)
        if div_col and not df[div_col].empty:
            div = df[div_col].dropna().unique()
            if len(div) > 0:
                competition = str(div[0])
                if competition.startswith('E'): country = 'England'
                elif competition.startswith('D'): country = 'Germany'
                elif competition.startswith('I'): country = 'Italy'
                elif competition.startswith('SP'): country = 'Spain'
                elif competition.startswith('F'): country = 'France'
        
        season = "Unknown"
        # Often in football-data.co.uk, season is in the filename like E0_1920.csv
        basename = os.path.basename(filepath)
        if '_' in basename:
            parts = basename.split('_')
            if len(parts) > 1:
                szn = parts[1].split('.')[0]
                if len(szn) == 4 and szn.isdigit():
                    season = f"20{szn[:2]}/20{szn[2:]}"
                    
        quality_score = 100
        if rows == 0:
            quality_score = 0
        else:
            total_missing = missing_counts.sum()
            total_cells = rows * cols
            quality_score = max(0, 100 - (total_missing / total_cells * 100) - (duplicates / rows * 10))
            
        return {
            'File Path': filepath,
            'Competition': competition,
            'Season': season,
            'Country': country,
            'Rows': rows,
            'Columns': cols,
            'Primary Keys': 'None explicit',
            'Date Range': date_range,
            'Missing Values %': sum(missing_counts) / (rows * cols) * 100 if rows > 0 else 0,
            'Duplicate Rows': int(duplicates),
            'Encoding': 'latin1',
            'Delimiter': ',',
            'Estimated Source': 'football-data.co.uk' if 'football_data_co_uk' in filepath else 'Unknown',
            'Bookmakers Available': len([c for c in columns if len(c) == 3 and c.endswith('H') or c.endswith('D') or c.endswith('A')]),
            'Prediction Columns': 0,
            'Odds Columns': len([c for c in columns if 'H' in c or 'D' in c or 'A' in c or 'O' in c or 'U' in c]),
            'Market Columns': len([c for c in columns if c.startswith('B365') or c.startswith('PS') or c.startswith('Max') or c.startswith('Avg')]),
            'Quality Score': round(quality_score, 2),
            'Raw Columns': columns
        }
    except Exception as e:
        return {'File Path': filepath, 'Error': str(e)}

datasets = find_datasets(".")
results = []
for d in datasets:
    res = profile_csv(d)
    if 'Error' not in res:
        results.append(res)
    else:
        print(f"Failed to profile {d}: {res['Error']}")

with open('epic_58a_audit/audit_results.json', 'w') as f:
    json.dump(results, f, indent=2)

print("Audit profiling complete. Results saved.")
