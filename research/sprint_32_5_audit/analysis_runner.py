#!/usr/bin/env python3
"""
EPIC 32.5 — Historical Research Audit & Probability Discovery
Computational Analysis Script

Reads gold datasets and produces reproducible research findings.
Output: research/sprint_32_5_audit/findings.json

Usage: python research/sprint_32_5_audit/analysis_runner.py
"""

import json
import os
import math
import csv
from collections import defaultdict

# Paths
DATA_DIR = "data/gold"

# Gold dataset seasons available (9 complete seasons: 2015-2016 through 2023-2024)
GOLD_SEASONS = [
    "2015-2016", "2016-2017", "2017-2018", "2018-2019", "2019-2020",
    "2020-2021", "2021-2022", "2022-2023", "2023-2024"
]

# Football-data.co.uk CSV seasons (9 complete seasons)
CSV_SEASONS = [
    "2015-2016", "2016-2017", "2017-2018", "2018-2019", "2019-2020",
    "2020-2021", "2021-2022", "2022-2023", "2023-2024"
]

# Bronze Understat seasons (10 seasons, including 2024-2025)
BRONZE_SEASONS = [
    "2015-2016", "2016-2017", "2017-2018", "2018-2019", "2019-2020",
    "2020-2021", "2021-2022", "2022-2023", "2023-2024", "2024-2025"
]


def load_json(path):
    with open(path) as f:
        return json.load(f)


def safe_div(a, b):
    return a / b if b > 0 else 0.0


def ci_proportion(p, n):
    """95% CI for proportion"""
    if n == 0:
        return (0.0, 0.0)
    se = math.sqrt(p * (1 - p) / n)
    return (p - 1.96 * se, p + 1.96 * se)


def load_csv_football_data():
    """Load football-data.co.uk CSVs for match-level data with scores."""
    all_matches = []
    for season in CSV_SEASONS:
        path = f"data/bronze/football_data/{season}.csv"
        if not os.path.exists(path):
            print(f"WARNING: {path} not found")
            continue
        with open(path, encoding="latin1") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    fthg = float(row["FTHG"]) if row["FTHG"] else 0
                    ftag = float(row["FTAG"]) if row["FTAG"] else 0
                    all_matches.append({
                        "season": season,
                        "date": row.get("Date", ""),
                        "home": row.get("HomeTeam", ""),
                        "away": row.get("AwayTeam", ""),
                        "fthg": int(fthg),
                        "ftag": int(ftag),
                        "ftr": row.get("FTR", ""),
                        "hs": float(row.get("HS", 0) or 0),
                        "as": float(row.get("AS", 0) or 0),
                        "hst": float(row.get("HST", 0) or 0),
                        "ast": float(row.get("AST", 0) or 0),
                        "hc": float(row.get("HC", 0) or 0),
                        "ac": float(row.get("AC", 0) or 0),
                        "b365h": float(row.get("B365H", 0) or 0),
                        "b365d": float(row.get("B365D", 0) or 0),
                        "b365a": float(row.get("B365A", 0) or 0),
                    })
                except (ValueError, KeyError) as e:
                    print(f"  WARNING: Parse error in {season}: {e}, row: {dict(row)}")
                    continue
        print(f"  {season}: {len([m for m in all_matches if m['season']==season])} matches loaded")
    return all_matches


def analyze_moneyline():
    """Analyze moneyline dataset for home advantage, draw rate, seasonal trends."""
    records = []
    for season in GOLD_SEASONS:
        data = load_json(f"{DATA_DIR}/moneyline/{season}.json")
        records.extend(data)
    
    n = len(records)
    print(f"  ML Records: {n} (from {len(GOLD_SEASONS)} seasons)")
    
    home_wins = sum(1 for r in records if r["target"] == "H")
    draws = sum(1 for r in records if r["target"] == "D")
    away_wins = sum(1 for r in records if r["target"] == "A")
    
    results = {
        "total_matches": n,
        "seasons_count": len(GOLD_SEASONS),
        "seasons": list(GOLD_SEASONS),
        "home_win_pct": round(safe_div(home_wins, n) * 100, 1),
        "draw_pct": round(safe_div(draws, n) * 100, 1),
        "away_win_pct": round(safe_div(away_wins, n) * 100, 1),
        "home_ci": [round(v * 100, 1) for v in ci_proportion(home_wins/n, n)],
        "draw_ci": [round(v * 100, 1) for v in ci_proportion(draws/n, n)],
        "away_ci": [round(v * 100, 1) for v in ci_proportion(away_wins/n, n)],
        "seasonal_breakdown": []
    }
    
    for season in GOLD_SEASONS:
        data = load_json(f"{DATA_DIR}/moneyline/{season}.json")
        n_s = len(data)
        hw = sum(1 for r in data if r["target"] == "H")
        d = sum(1 for r in data if r["target"] == "D")
        aw = sum(1 for r in data if r["target"] == "A")
        results["seasonal_breakdown"].append({
            "season": season,
            "matches": n_s,
            "home_win_pct": round(safe_div(hw, n_s) * 100, 1),
            "draw_pct": round(safe_div(d, n_s) * 100, 1),
            "away_win_pct": round(safe_div(aw, n_s) * 100, 1)
        })
    
    return results


def analyze_goals(matches):
    """Analyze goal distribution from football-data.co.uk CSVs."""
    goals_dist = defaultdict(int)
    total_goals = 0
    total_matches = len(matches)
    season_data = []
    
    for season in CSV_SEASONS:
        season_matches = [m for m in matches if m["season"] == season]
        season_goals = sum(m["fthg"] + m["ftag"] for m in season_matches)
        for m in season_matches:
            total = m["fthg"] + m["ftag"]
            if total > 6:
                bucket = "6+"
            else:
                bucket = str(int(total))
            goals_dist[bucket] += 1
            total_goals += total
        season_data.append({
            "season": season,
            "matches": len(season_matches),
            "total_goals": season_goals,
            "avg_goals": round(safe_div(season_goals, len(season_matches)), 2)
        })
    
    avg_goals = safe_div(total_goals, total_matches)
    print(f"  Total matches: {total_matches}, Total goals: {total_goals}, Avg: {avg_goals:.2f}")
    
    result = {
        "total_matches": total_matches,
        "total_goals": total_goals,
        "avg_goals_per_match": round(avg_goals, 2),
        "seasons_count": len(season_data),
        "seasons": season_data,
        "goal_distribution": {}
    }
    
    for bucket in ["0", "1", "2", "3", "4", "5", "6+"]:
        count = goals_dist.get(bucket, 0)
        result["goal_distribution"][f"{bucket}_goals"] = {
            "count": count,
            "pct": round(safe_div(count, total_matches) * 100, 1)
        }
    
    return result


def analyze_goal_trends(matches):
    """Analyze goal trends: btts, home advantage by goals."""
    total = len(matches)
    
    # BTTS
    btts = sum(1 for m in matches if m["fthg"] > 0 and m["ftag"] > 0)
    
    # Home/Away avg goals
    home_goals_total = sum(m["fthg"] for m in matches)
    away_goals_total = sum(m["ftag"] for m in matches)
    
    # Season by season
    season_stats = []
    for season in CSV_SEASONS:
        sm = [m for m in matches if m["season"] == season]
        n_s = len(sm)
        sg = sum(m["fthg"] + m["ftag"] for m in sm)
        sbtts = sum(1 for m in sm if m["fthg"] > 0 and m["ftag"] > 0)
        shg = sum(m["fthg"] for m in sm)
        sag = sum(m["ftag"] for m in sm)
        season_stats.append({
            "season": season,
            "matches": n_s,
            "avg_goals": round(safe_div(sg, n_s), 2),
            "btts_pct": round(safe_div(sbtts, n_s) * 100, 1),
            "home_goals_avg": round(safe_div(shg, n_s), 2),
            "away_goals_avg": round(safe_div(sag, n_s), 2)
        })
    
    return {
        "total_matches": total,
        "btts_pct": round(safe_div(btts, total) * 100, 1),
        "home_goals_avg": round(safe_div(home_goals_total, total), 2),
        "away_goals_avg": round(safe_div(away_goals_total, total), 2),
        "season_stats": season_stats
    }


def analyze_over_under():
    """Analyze over/under dataset for win/loss distribution."""
    records = []
    for season in GOLD_SEASONS:
        data = load_json(f"{DATA_DIR}/over_under/{season}.json")
        records.extend(data)
    
    n = len(records)
    wins = sum(1 for r in records if r["target"] == "WIN")
    losses = sum(1 for r in records if r["target"] == "LOSS")
    pushes = sum(1 for r in records if r["target"] == "PUSH")
    
    print(f"  OU Records: {n}, Wins: {wins}, Losses: {losses}, Pushes: {pushes}")
    
    return {
        "total": n,
        "seasons": list(GOLD_SEASONS),
        "seasons_count": len(GOLD_SEASONS),
        "win_pct": round(safe_div(wins, n) * 100, 1),
        "loss_pct": round(safe_div(losses, n) * 100, 1),
        "push_pct": round(safe_div(pushes, n) * 100, 1)
    }


def analyze_asian_handicap():
    """Analyze Asian handicap dataset for win/loss/push distribution."""
    records = []
    for season in GOLD_SEASONS:
        data = load_json(f"{DATA_DIR}/asian_handicap/{season}.json")
        records.extend(data)
    
    n = len(records)
    wins = sum(1 for r in records if r["target"] == "WIN")
    losses = sum(1 for r in records if r["target"] == "LOSS")
    pushes = sum(1 for r in records if r["target"] == "PUSH")
    
    print(f"  AH Records: {n}, Wins: {wins}, Losses: {losses}, Pushes: {pushes}")
    
    return {
        "total": n,
        "seasons": list(GOLD_SEASONS),
        "seasons_count": len(GOLD_SEASONS),
        "win_pct": round(safe_div(wins, n) * 100, 1),
        "loss_pct": round(safe_div(losses, n) * 100, 1),
        "push_pct": round(safe_div(pushes, n) * 100, 1)
    }


def analyze_odds_calibration(matches):
    """Analyze Bet365 odds calibration vs actual outcomes."""
    bins = {
        "1.01-1.50": {"min": 1.01, "max": 1.50, "count": 0, "wins": 0},
        "1.50-2.00": {"min": 1.50, "max": 2.00, "count": 0, "wins": 0},
        "2.00-2.50": {"min": 2.00, "max": 2.50, "count": 0, "wins": 0},
        "2.50-3.00": {"min": 2.50, "max": 3.00, "count": 0, "wins": 0},
        "3.00-4.00": {"min": 3.00, "max": 4.00, "count": 0, "wins": 0},
        "4.00-6.00": {"min": 4.00, "max": 6.00, "count": 0, "wins": 0},
        "6.00-10.00": {"min": 6.00, "max": 10.00, "count": 0, "wins": 0},
        "> 10.00": {"min": 10.00, "max": 999, "count": 0, "wins": 0},
    }
    
    for m in matches:
        if m["b365h"] == 0:
            continue
        odds = m["b365h"]
        implied = 1.0 / odds
        actual_win = 1 if m["ftr"] == "H" else 0
        
        for label, b in bins.items():
            if b["min"] <= odds < b["max"]:
                b["count"] += 1
                b["wins"] += actual_win
                break
    
    results = []
    for label, b in bins.items():
        if b["count"] == 0:
            continue
        win_pct = safe_div(b["wins"], b["count"]) * 100
        avg_implied = safe_div(sum(1.0/m["b365h"] for m in matches if b["min"] <= m["b365h"] < b["max"] and m["b365h"] > 0), b["count"]) * 100
        results.append({
            "odds_range": label,
            "count": b["count"],
            "avg_implied_pct": round(avg_implied, 1),
            "actual_win_pct": round(win_pct, 1),
            "edge": round(win_pct - avg_implied, 1)
        })
    
    return results


def main():
    os.makedirs("research/sprint_32_5_audit", exist_ok=True)
    
    findings = {
        "metadata": {
            "audit": "EPIC 32.5 Historical Research Audit",
            "date": "2026-07-17",
            "gold_seasons": GOLD_SEASONS,
            "csv_seasons": CSV_SEASONS,
            "dataset_version": "v0.32.0"
        }
    }
    
    print("=" * 60)
    print("EPIC 32.5 — Historical Research Audit")
    print("=" * 60)
    
    print("\n--- Loading football-data.co.uk CSVs ---")
    matches = load_csv_football_data()
    
    print("\n--- Moneyline Analysis ---")
    findings["moneyline"] = analyze_moneyline()
    
    print("\n--- Goal Distribution ---")
    findings["goals"] = analyze_goals(matches)
    
    print("\n--- Goal Trends (BTTS, Home/Away Goals) ---")
    findings["goal_trends"] = analyze_goal_trends(matches)
    
    print("\n--- Over/Under Analysis ---")
    findings["over_under"] = analyze_over_under()
    
    print("\n--- Asian Handicap Analysis ---")
    findings["asian_handicap"] = analyze_asian_handicap()
    
    print("\n--- Odds Calibration Analysis ---")
    findings["odds_calibration"] = analyze_odds_calibration(matches)
    
    output_path = "research/sprint_32_5_audit/findings.json"
    with open(output_path, "w") as f:
        json.dump(findings, f, indent=2, default=str)
    
    print(f"\nFindings written to {output_path}")
    print("EPIC 32.5 audit complete.")


if __name__ == "__main__":
    main()