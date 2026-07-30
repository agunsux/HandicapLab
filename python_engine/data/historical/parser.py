"""
data/historical/parser.py — Normalize football-data.co.uk CSVs into HistoricalMatch dicts.
Handles missing/renamed columns gracefully across seasons (Amendment D).
"""
import os
import csv
from datetime import datetime
from typing import List, Dict, Optional


# Map from league code → league display name
CODE_TO_LEAGUE = {
    "E0": "EPL",
    "SP1": "La Liga",
    "D1": "Bundesliga",
    "I1": "Serie A",
    "F1": "Ligue 1",
    "B1": "Brasileirao",
}


def _safe_float(val) -> Optional[float]:
    """Convert to float safely, return None on failure."""
    if val is None or str(val).strip() == '':
        return None
    try:
        return float(val)
    except (ValueError, TypeError):
        return None


def _safe_int(val) -> Optional[int]:
    """Convert to int safely, return None on failure."""
    if val is None or str(val).strip() == '':
        return None
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return None


def _try_columns(row: dict, candidates: List[str]) -> Optional[float]:
    """Try multiple column names, return first valid float."""
    for col in candidates:
        val = _safe_float(row.get(col))
        if val is not None:
            return val
    return None


def _parse_date(date_str: str) -> Optional[datetime]:
    """Parse date from football-data.co.uk format (dd/mm/yyyy or dd/mm/yy)."""
    for fmt in ('%d/%m/%Y', '%d/%m/%y', '%Y-%m-%d'):
        try:
            return datetime.strptime(date_str.strip(), fmt)
        except (ValueError, AttributeError):
            continue
    return None


def parse_csv(filepath: str) -> List[Dict]:
    """
    Parse a single football-data.co.uk CSV into normalized match dicts.
    
    Skips rows missing FTHG/FTAG or with ALL odds columns missing.
    Handles column name variations across seasons.
    """
    # Detect league from filename
    basename = os.path.basename(filepath)  # e.g., "E0_2324.csv"
    code = basename.split('_')[0]
    season = basename.split('_')[1].replace('.csv', '')
    league = CODE_TO_LEAGUE.get(code, code)

    matches = []

    with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # --- REQUIRED: Result columns ---
            fthg = _safe_int(row.get('FTHG'))
            ftag = _safe_int(row.get('FTAG'))
            ftr = row.get('FTR', '').strip()

            if fthg is None or ftag is None or ftr not in ('H', 'D', 'A'):
                continue  # Skip invalid rows

            # --- Date ---
            date = _parse_date(row.get('Date', ''))
            if date is None:
                continue

            home_team = row.get('HomeTeam', row.get('HT', '')).strip()
            away_team = row.get('AwayTeam', row.get('AT', '')).strip()
            if not home_team or not away_team:
                continue

            # --- Moneyline odds ---
            # Retail (B365 = what the bettor gets)
            b365h = _safe_float(row.get('B365H'))
            b365d = _safe_float(row.get('B365D'))
            b365a = _safe_float(row.get('B365A'))

            # Pinnacle closing (sharp benchmark for CLV)
            psh = _try_columns(row, ['PSH', 'PH'])
            psd = _try_columns(row, ['PSD', 'PD'])
            psa = _try_columns(row, ['PSA', 'PA'])

            # Market average
            avg_h = _try_columns(row, ['BbAvH', 'AvgH'])
            avg_d = _try_columns(row, ['BbAvD', 'AvgD'])
            avg_a = _try_columns(row, ['BbAvA', 'AvgA'])

            # --- Over/Under 2.5 ---
            b365_o25 = _try_columns(row, ['B365>2.5', 'BbMx>2.5'])
            b365_u25 = _try_columns(row, ['B365<2.5', 'BbMx<2.5'])
            p_o25 = _try_columns(row, ['P>2.5'])
            p_u25 = _try_columns(row, ['P<2.5'])
            avg_o25 = _try_columns(row, ['Avg>2.5'])
            avg_u25 = _try_columns(row, ['Avg<2.5'])

            # --- Asian Handicap ---
            ahh = _safe_float(row.get('AHh'))  # AH line from home perspective
            b365ahh = _safe_float(row.get('B365AHH'))
            b365aha = _safe_float(row.get('B365AHA'))
            pahh = _safe_float(row.get('PAHH'))
            paha = _safe_float(row.get('PAHA'))

            # --- Check if ANY odds exist ---
            has_ml_odds = b365h is not None or psh is not None
            has_ou_odds = b365_o25 is not None or p_o25 is not None
            has_ah_odds = (b365ahh is not None or pahh is not None) and ahh is not None

            if not (has_ml_odds or has_ou_odds or has_ah_odds):
                continue  # Skip rows with no odds at all

            match = {
                'date': date,
                'home_team': home_team,
                'away_team': away_team,
                'fthg': fthg,
                'ftag': ftag,
                'ftr': ftr,
                'league': league,
                'season': season,
                # Moneyline
                'b365h': b365h, 'b365d': b365d, 'b365a': b365a,
                'psh': psh, 'psd': psd, 'psa': psa,
                'avg_h': avg_h, 'avg_d': avg_d, 'avg_a': avg_a,
                # Over/Under 2.5
                'b365_o25': b365_o25, 'b365_u25': b365_u25,
                'p_o25': p_o25, 'p_u25': p_u25,
                'avg_o25': avg_o25, 'avg_u25': avg_u25,
                # Asian Handicap
                'ahh': ahh,
                'b365ahh': b365ahh, 'b365aha': b365aha,
                'pahh': pahh, 'paha': paha,
            }
            matches.append(match)

    return matches


def parse_all(filepaths: List[str]) -> Dict[str, List[Dict]]:
    """
    Parse all CSVs, grouped by league.
    Returns: { 'EPL': [match1, match2, ...], 'La Liga': [...], ... }
    """
    by_league = {}
    total_matches = 0

    for fp in filepaths:
        matches = parse_csv(fp)
        if not matches:
            continue
        league = matches[0]['league']
        if league not in by_league:
            by_league[league] = []
        by_league[league].extend(matches)
        total_matches += len(matches)

    # Sort each league by date
    for league in by_league:
        by_league[league].sort(key=lambda m: m['date'])

    print(f"  Parsed {total_matches} total matches across {len(by_league)} leagues.")
    for league, matches in sorted(by_league.items()):
        date_range = f"{matches[0]['date'].strftime('%Y-%m-%d')} to {matches[-1]['date'].strftime('%Y-%m-%d')}"
        print(f"    {league}: {len(matches)} matches ({date_range})")

    return by_league
