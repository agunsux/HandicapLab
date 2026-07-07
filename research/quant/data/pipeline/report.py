import pandas as pd
from pathlib import Path
from typing import Dict

def generate_quality_report(quality_data: Dict, output_dir: str):
    out_path = Path(output_dir) / "Quality_Report.md"
    
    lines = [
        "# Data Quality Report",
        "",
        f"**Overall Data Quality Score**: {quality_data['overall_score']:.2f} / 100",
        ""
    ]
    
    lines.append("| Metric | Score |")
    lines.append("| --- | ---: |")
    for k, v in quality_data['metrics'].items():
        lines.append(f"| {k} | {v:.2f}% |")
        
    lines.append("")
    if quality_data['overall_score'] < 95.0:
        lines.append("> [!WARNING]")
        lines.append("> Overall score is below 95%. Please review the data ingestion pipeline.")
    else:
        lines.append("> [!NOTE]")
        lines.append("> Data Quality is within acceptable thresholds.")
        
    with open(out_path, 'w') as f:
        f.write("\n".join(lines))
        
def generate_historical_coverage_report(df: pd.DataFrame, output_dir: str):
    out_path = Path(output_dir) / "Historical_Coverage_Report.md"
    
    lines = [
        "# Historical Data Coverage Report",
        ""
    ]
    
    # We want to group by league and summarize seasons, matches, and odds coverage
    if df.empty:
        lines.append("No data available.")
    else:
        lines.append("| League | Seasons | Matches | Odds (1X2) | Odds (AH) | Odds (OU) |")
        lines.append("| --- | --- | ---: | ---: | ---: | ---: |")
        
        leagues = df['league_id'].unique()
        for l in leagues:
            ldf = df[df['league_id'] == l]
            seasons = sorted(ldf['season'].unique())
            season_str = f"{seasons[0]} - {seasons[-1]}" if len(seasons) > 1 else str(seasons[0])
            
            matches = len(ldf)
            
            # Simple coverage check (1x2 assumed if bet365_1 exists)
            ml_cov = (ldf['odds_bet365_1'].notnull().sum() / matches) * 100 if 'odds_bet365_1' in ldf.columns else 0
            # Stub AH and OU for now
            ah_cov = 0
            ou_cov = 0
            
            lines.append(f"| {l} | {season_str} | {matches} | {ml_cov:.1f}% | {ah_cov:.1f}% | {ou_cov:.1f}% |")
            
    with open(out_path, 'w') as f:
        f.write("\n".join(lines))
