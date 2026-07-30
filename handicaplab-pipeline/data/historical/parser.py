"""
Historical CSV Parser
=====================
Normalizes football-data.co.uk CSVs into a canonical list of match dicts.

Handles:
- Missing columns gracefully (older seasons vary)
- Multiple date formats
- Multiple bookmaker column naming conventions
"""

import logging
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

logger = logging.getLogger(__name__)


@dataclass
class HistoricalMatch:
    date: str
    league: str
    home_team: str
    away_team: str
    fthg: int
    ftag: int
    ftr: str
    ah_line: float
    b365h: float
    b365d: float
    b365a: float
    pinnacle_h: float
    pinnacle_d: float
    pinnacle_a: float
    bav_h: float
    bav_d: float
    bav_a: float
    b365_over: float
    b365_under: float
    pinnacle_over: float
    pinnacle_under: float
    avg_over: float
    avg_under: float
    b365_ahh: float
    b365_aha: float
    pinnacle_ahh: float
    pinnacle_aha: float
    avg_ahh: float
    avg_aha: float


def _find_column(df: pd.DataFrame, candidates: list) -> Optional[str]:
    for col in candidates:
        if col in df.columns:
            return col
    return None


def _parse_odds(val: Any) -> Optional[float]:
    if pd.isna(val):
        return None
    try:
        f = float(val)
        return f if f > 1.0 else None
    except (ValueError, TypeError):
        return None


def _parse_date(val: Any) -> Optional[str]:
    if pd.isna(val):
        return None
    val = str(val).strip()
    for fmt in ("%d/%m/%y", "%d/%m/%Y", "%Y-%m-%d"):
        try:
            dt = pd.to_datetime(val, format=fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def parse_csv(file_path: str) -> List[Dict[str, Any]]:
    """
    Parse a single football-data.co.uk CSV into canonical match dicts.

    Args:
        file_path: Path to CSV file

    Returns:
        List of match dicts
    """
    path = Path(file_path)
    league_name = path.stem.rsplit("_", 1)[0]

    try:
        df = pd.read_csv(file_path, encoding="latin1", on_bad_lines="skip")
    except Exception as e:
        logger.error(f"[Parser] Failed to read {file_path}: {e}")
        return []

    if df.empty:
        return []

    # Column mapping
    date_col = _find_column(df, ["Date"])
    home_col = _find_column(df, ["HomeTeam"])
    away_col = _find_column(df, ["AwayTeam"])
    fthg_col = _find_column(df, ["FTHG"])
    ftag_col = _find_column(df, ["FTAG"])
    ftr_col = _find_column(df, ["FTR"])
    ahh_col = _find_column(df, ["AHh"])

    # Moneyline odds
    b365h_col = _find_column(df, ["B365H"])
    b365d_col = _find_column(df, ["B365D"])
    b365a_col = _find_column(df, ["B365A"])
    psh_col = _find_column(df, ["PSH", "PH"])
    psd_col = _find_column(df, ["PSD", "PD"])
    psa_col = _find_column(df, ["PSA", "PA"])
    bah_col = _find_column(df, ["BbAvH"])
    bad_col = _find_column(df, ["BbAvD"])
    baa_col = _find_column(df, ["BbAvA"])

    # Totals odds
    b365o_col = _find_column(df, ["B365>2.5", "B365O2.5", "B365Over2.5"])
    b365u_col = _find_column(df, ["B365<2.5", "B365U2.5", "B365Under2.5"])
    po_col = _find_column(df, ["P>2.5", "PO2.5", "POver2.5"])
    pu_col = _find_column(df, ["P<2.5", "PU2.5", "PUnder2.5"])
    avgo_col = _find_column(df, ["Avg>2.5", "AvgO2.5", "AvgOver2.5"])
    avgu_col = _find_column(df, ["Avg<2.5", "AvgU2.5", "AvgUnder2.5"])

    # AH odds
    b365ahh_col = _find_column(df, ["B365AHH"])
    b365aha_col = _find_column(df, ["B365AHA"])
    pahh_col = _find_column(df, ["PAHH"])
    paha_col = _find_column(df, ["PAHA"])
    avgahh_col = _find_column(df, ["AvgAHH"])
    avgaha_col = _find_column(df, ["AvgAHA"])

    matches = []
    skipped = 0

    for _, row in df.iterrows():
        # Skip if missing essential data
        if fthg_col is None or ftag_col is None:
            skipped += 1
            continue

        fthg = row[fthg_col]
        ftag = row[ftag_col]

        if pd.isna(fthg) or pd.isna(ftag):
            skipped += 1
            continue

        fthg = int(fthg)
        ftag = int(ftag)
        ftr = str(row[ftr_col]).strip() if ftr_col else ""

        # Parse date
        date_str = _parse_date(row[date_col]) if date_col else None
        if not date_str:
            skipped += 1
            continue

        # Parse odds
        b365h = _parse_odds(row[b365h_col]) if b365h_col else None
        b365d = _parse_odds(row[b365d_col]) if b365d_col else None
        b365a = _parse_odds(row[b365a_col]) if b365a_col else None
        pinnacle_h = _parse_odds(row[psh_col]) if psh_col else None
        pinnacle_d = _parse_odds(row[psd_col]) if psd_col else None
        pinnacle_a = _parse_odds(row[psa_col]) if psa_col else None
        bah = _parse_odds(row[bah_col]) if bah_col else None
        bad = _parse_odds(row[bad_col]) if bad_col else None
        baa = _parse_odds(row[baa_col]) if baa_col else None

        b365_over = _parse_odds(row[b365o_col]) if b365o_col else None
        b365_under = _parse_odds(row[b365u_col]) if b365u_col else None
        pinnacle_over = _parse_odds(row[po_col]) if po_col else None
        pinnacle_under = _parse_odds(row[pu_col]) if pu_col else None
        avg_over = _parse_odds(row[avgo_col]) if avgo_col else None
        avg_under = _parse_odds(row[avgu_col]) if avgu_col else None

        b365_ahh = _parse_odds(row[b365ahh_col]) if b365ahh_col else None
        b365_aha = _parse_odds(row[b365aha_col]) if b365aha_col else None
        pinnacle_ahh = _parse_odds(row[pahh_col]) if pahh_col else None
        pinnacle_aha = _parse_odds(row[paha_col]) if paha_col else None
        avg_ahh = _parse_odds(row[avgahh_col]) if avgahh_col else None
        avg_aha = _parse_odds(row[avgaha_col]) if avgaha_col else None

        ah_line = 0.0
        if ahh_col and not pd.isna(row[ahh_col]):
            try:
                ah_line = float(row[ahh_col])
            except (ValueError, TypeError):
                ah_line = 0.0

        # Skip if missing all odds columns
        all_odds = [b365h, b365d, b365a, b365_over, b365_under, b365_ahh, b365_aha]
        if all(v is None for v in all_odds):
            skipped += 1
            continue

        matches.append({
            "date": date_str,
            "league": league_name,
            "home_team": str(row[home_col]).strip() if home_col else "",
            "away_team": str(row[away_col]).strip() if away_col else "",
            "fthg": fthg,
            "ftag": ftag,
            "ftr": ftr,
            "ah_line": ah_line,
            "b365h": b365h,
            "b365d": b365d,
            "b365a": b365a,
            "pinnacle_h": pinnacle_h,
            "pinnacle_d": pinnacle_d,
            "pinnacle_a": pinnacle_a,
            "bav_h": bah,
            "bav_d": bad,
            "bav_a": baa,
            "b365_over": b365_over,
            "b365_under": b365_under,
            "pinnacle_over": pinnacle_over,
            "pinnacle_under": pinnacle_under,
            "avg_over": avg_over,
            "avg_under": avg_under,
            "b365_ahh": b365_ahh,
            "b365_aha": b365_aha,
            "pinnacle_ahh": pinnacle_ahh,
            "pinnacle_aha": pinnacle_aha,
            "avg_ahh": avg_ahh,
            "avg_aha": avg_aha,
        })

    if skipped > 0:
        logger.info(f"[Parser] Skipped {skipped} rows in {path.name}")

    return matches


def parse_all(cache_dir: str = None) -> List[Dict[str, Any]]:
    """
    Parse all cached CSVs.

    Args:
        cache_dir: Directory containing cached CSVs

    Returns:
        Combined list of match dicts from all files
    """
    if cache_dir is None:
        cache_dir = os.path.join(
            os.path.dirname(__file__), "..", "historical", "csv"
        )

    csv_dir = Path(cache_dir)
    if not csv_dir.exists():
        logger.error(f"[Parser] CSV directory not found: {csv_dir}")
        return []

    files = sorted(csv_dir.glob("*.csv"))
    if not files:
        logger.warning(f"[Parser] No CSV files found in {csv_dir}")
        return []

    all_matches = []
    for file_path in files:
        matches = parse_csv(str(file_path))
        all_matches.extend(matches)

    logger.info(f"[Parser] Parsed {len(all_matches)} matches from {len(files)} files")
    return all_matches
