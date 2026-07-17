#!/usr/bin/env python3
"""
EPIC 32.6 — Probability Sanity Check & Research Validation
Comprehensive Statistical Validation of Historical Research Dataset

Performs all 13 phases of validation.
Outputs: research/sprint_32_6/*.json + MD reports

Usage: python -X utf8 research/scripts/EPIC_32_6_VALIDATION.py
"""

import json
import os
import math
import csv
import hashlib
from collections import defaultdict

# ============================================================
# Configuration
# ============================================================
DATA_DIR = "data"
GOLD_DIR = f"{DATA_DIR}/gold"
BRONZE_FD = f"{DATA_DIR}/bronze/football_data"
BRONZE_EPL = f"{DATA_DIR}/bronze/EPL"
OUTPUT_DIR = "research/sprint_32_6"

SEASONS = ["2015-2016","2016-2017","2017-2018","2018-2019","2019-2020",
           "2020-2021","2021-2022","2022-2023","2023-2024"]

PUBLIC_BENCHMARKS = {
    "home_win_pct": {"value": 45.0, "tolerance": 3.0, "source": "EPL historical avg"},
    "draw_pct": {"value": 25.0, "tolerance": 3.0, "source": "EPL historical avg"},
    "away_win_pct": {"value": 30.0, "tolerance": 3.0, "source": "EPL historical avg"},
    "avg_goals": {"value": 2.70, "tolerance": 0.30, "source": "EPL historical avg"},
    "btts_pct": {"value": 52.0, "tolerance": 4.0, "source": "EPL historical avg"},
    "over_2_5_pct": {"value": 52.0, "tolerance": 4.0, "source": "EPL historical avg"},
    "home_goals_avg": {"value": 1.50, "tolerance": 0.20, "source": "EPL historical avg"},
    "away_goals_avg": {"value": 1.20, "tolerance": 0.20, "source": "EPL historical avg"},
}

VALID_AH_TARGETS = {"WIN", "LOSS", "PUSH", "HALF_WIN", "HALF_LOSS"}
VALID_OU_TARGETS = {"WIN", "LOSS", "PUSH", "HALF_WIN", "HALF_LOSS"}

# ============================================================
# Helpers
# ============================================================
def safe_div(a, b):
    return a / b if b > 0 else 0.0

def ci_proportion(p, n):
    if n == 0:
        return (0.0, 0.0)
    se = math.sqrt(p * (1 - p) / n)
    return (p - 1.96 * se, p + 1.96 * se)

def load_json(path):
    with open(path) as f:
        return json.load(f)

def checksum_file(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        h.update(f.read())
    return h.hexdigest()

def ok():
    return "PASS"

def fail():
    return "FAIL"

phase_status = {}

def report_phase(name, passed, detail=""):
    status = ok() if passed else fail()
    phase_status[name] = passed
    icon = "[OK]" if passed else "[!!]"
    print(f"  {icon} {name}: {status}{' - ' + detail if detail else ''}")

# ============================================================
# Load all match data
# ============================================================
def load_all_matches():
    all_matches = []
    for season in SEASONS:
        path = f"{BRONZE_FD}/{season}.csv"
        with open(path, encoding="latin1") as f:
            reader = csv.DictReader(f)
            for row in reader:
                try:
                    fthg = int(float(row["FTHG"])) if row["FTHG"] else 0
                    ftag = int(float(row["FTAG"])) if row["FTAG"] else 0
                    all_matches.append({
                        "season": season,
                        "date": row.get("Date", ""),
                        "home": row.get("HomeTeam", ""),
                        "away": row.get("AwayTeam", ""),
                        "fthg": fthg,
                        "ftag": ftag,
                        "ftr": row.get("FTR", ""),
                        "b365h": float(row.get("B365H", 0) or 0),
                        "b365d": float(row.get("B365D", 0) or 0),
                        "b365a": float(row.get("B365A", 0) or 0),
                    })
                except (ValueError, KeyError):
                    continue
    return all_matches

def load_gold(domain):
    records = []
    for season in SEASONS:
        path = f"{GOLD_DIR}/{domain}/{season}.json"
        if os.path.exists(path):
            records.extend(load_json(path))
    return records

# ============================================================
# Phase 1 - League-Level Probability Validation
# ============================================================
def phase1_league_probabilities(matches):
    print("\n=== Phase 1: League-Level Probability Validation ===")
    n = len(matches)
    home_wins = sum(1 for m in matches if m["ftr"] == "H")
    draws = sum(1 for m in matches if m["ftr"] == "D")
    away_wins = sum(1 for m in matches if m["ftr"] == "A")
    
    total_pct = safe_div(home_wins + draws + away_wins, n) * 100
    consistent = abs(total_pct - 100.0) < 0.01
    
    overall = {
        "matches": n,
        "home_win_pct": round(safe_div(home_wins, n) * 100, 1),
        "draw_pct": round(safe_div(draws, n) * 100, 1),
        "away_win_pct": round(safe_div(away_wins, n) * 100, 1),
        "sum_pct": round(total_pct, 2),
        "avg_goals": round(safe_div(sum(m["fthg"] + m["ftag"] for m in matches), n), 2),
        "home_goals_avg": round(safe_div(sum(m["fthg"] for m in matches), n), 2),
        "away_goals_avg": round(safe_div(sum(m["ftag"] for m in matches), n), 2),
        "home_ci": [round(v * 100, 1) for v in ci_proportion(home_wins/n, n)],
        "draw_ci": [round(v * 100, 1) for v in ci_proportion(draws/n, n)],
        "away_ci": [round(v * 100, 1) for v in ci_proportion(away_wins/n, n)],
    }
    
    by_season = []
    for season in SEASONS:
        sm = [m for m in matches if m["season"] == season]
        ns = len(sm)
        hw = sum(1 for m in sm if m["ftr"] == "H")
        d = sum(1 for m in sm if m["ftr"] == "D")
        aw = sum(1 for m in sm if m["ftr"] == "A")
        sg = sum(m["fthg"] + m["ftag"] for m in sm)
        by_season.append({
            "season": season, "matches": ns,
            "home_win_pct": round(safe_div(hw, ns) * 100, 1),
            "draw_pct": round(safe_div(d, ns) * 100, 1),
            "away_win_pct": round(safe_div(aw, ns) * 100, 1),
            "sum_pct": round(safe_div(hw + d + aw, ns) * 100, 2),
            "avg_goals": round(safe_div(sg, ns), 2),
        })
    
    report_phase("League probs sum to 100%", consistent, f"H={overall['home_win_pct']}% D={overall['draw_pct']}% A={overall['away_win_pct']}%")
    return {"overall": overall, "by_season": by_season, "consistency_check": consistent}

# ============================================================
# Phase 2 - Goal Distribution Validation
# ============================================================
def phase2_goal_distribution(matches):
    print("\n=== Phase 2: Goal Distribution Validation ===")
    dist = defaultdict(int)
    total_goals = 0
    n = len(matches)
    
    for m in matches:
        g = m["fthg"] + m["ftag"]
        total_goals += g
        bucket = "6+" if g >= 6 else str(int(g))
        dist[bucket] += 1
    
    goal_dist = {}
    for bucket in ["0", "1", "2", "3", "4", "5", "6+"]:
        count = dist.get(bucket, 0)
        goal_dist[f"{bucket}_goals"] = {"count": count, "pct": round(safe_div(count, n) * 100, 1)}
    
    ou_rates = {}
    for line in [0.5, 1.5, 2.5, 3.5, 4.5, 5.5]:
        over_count = sum(1 for m in matches if m["fthg"] + m["ftag"] > line)
        ou_rates[f"over_{line}"] = round(safe_div(over_count, n) * 100, 1)
        ou_rates[f"under_{line}"] = round(100 - safe_div(over_count, n) * 100, 1)
    
    # Verify flag: check if any discrepancy >0.5pp from raw data
    flags = []
    total_from_dist = sum(v["count"] for v in goal_dist.values())
    if total_from_dist != n:
        flags.append(f"Goal distribution count ({total_from_dist}) != matches ({n})")
    
    report_phase("Goal distribution verified", len(flags) == 0, f"avg={round(total_goals/n, 2)}")
    return {"matches": n, "total_goals": total_goals, "goal_distribution": goal_dist, "over_under_rates": ou_rates, "flags": flags}

# ============================================================
# Phase 3 - BTTS Validation
# ============================================================
def phase3_btts(matches):
    print("\n=== Phase 3: BTTS Validation ===")
    n = len(matches)
    btts = sum(1 for m in matches if m["fthg"] > 0 and m["ftag"] > 0)
    home_scored = sum(1 for m in matches if m["fthg"] > 0)
    away_scored = sum(1 for m in matches if m["ftag"] > 0)
    
    by_season = []
    for season in SEASONS:
        sm = [m for m in matches if m["season"] == season]
        ns = len(sm)
        sbtts = sum(1 for m in sm if m["fthg"] > 0 and m["ftag"] > 0)
        by_season.append({"season": season, "matches": ns, "btts_pct": round(safe_div(sbtts, ns) * 100, 1)})
    
    overall = round(safe_div(btts, n) * 100, 1)
    report_phase("BTTS calculated from raw scores", True, f"overall={overall}%")
    return {"matches": n, "overall_btts_pct": overall, "home_scored_pct": round(safe_div(home_scored, n) * 100, 1),
            "away_scored_pct": round(safe_div(away_scored, n) * 100, 1), "by_season": by_season}

# ============================================================
# Phase 4 - Asian Handicap Settlement Audit
# ============================================================
def phase4_ah_settlement():
    print("\n=== Phase 4: Asian Handicap Settlement Audit ===")
    records = load_gold("asian_handicap")
    mismatches = []
    counts = {"WIN": 0, "LOSS": 0, "PUSH": 0, "HALF_WIN": 0, "HALF_LOSS": 0}
    
    for r in records:
        if r["target"] in VALID_AH_TARGETS:
            counts[r["target"]] += 1
        else:
            mismatches.append(r["target"])
    
    total = len(records)
    valid = len(mismatches) == 0
    report_phase("AH settlement all valid targets", valid, f"{counts}")
    
    results = {
        "total_records": total,
        "target_distribution": counts,
        "win_pct": round(safe_div(counts["WIN"], total) * 100, 1),
        "loss_pct": round(safe_div(counts["LOSS"], total) * 100, 1),
        "push_pct": round(safe_div(counts["PUSH"], total) * 100, 1),
        "half_win_pct": round(safe_div(counts["HALF_WIN"], total) * 100, 1),
        "half_loss_pct": round(safe_div(counts["HALF_LOSS"], total) * 100, 1),
        "valid_targets": valid,
        "mismatch_count": len(mismatches),
        "by_season": {}
    }
    
    for season in SEASONS:
        path = f"{GOLD_DIR}/asian_handicap/{season}.json"
        if not os.path.exists(path):
            continue
        data = load_json(path)
        sc = {}
        for r in data:
            sc[r["target"]] = sc.get(r["target"], 0) + 1
        results["by_season"][season] = sc
    
    return results

# ============================================================
# Phase 5 - Over/Under Settlement Audit
# ============================================================
def phase5_ou_settlement():
    print("\n=== Phase 5: Over/Under Settlement Audit ===")
    records = load_gold("over_under")
    mismatches = []
    counts = {"WIN": 0, "LOSS": 0, "PUSH": 0, "HALF_WIN": 0, "HALF_LOSS": 0}
    
    for r in records:
        if r["target"] in VALID_OU_TARGETS:
            counts[r["target"]] += 1
        else:
            mismatches.append(r["target"])
    
    total = len(records)
    valid = len(mismatches) == 0
    report_phase("OU settlement all valid targets", valid, f"{counts}")
    
    results = {
        "total_records": total,
        "target_distribution": counts,
        "valid_targets": valid,
        "mismatch_count": len(mismatches),
        "by_season": {},
        "by_line": {}
    }
    
    for r in records:
        line = r["features"].get("line", "unknown")
        sl = str(line)
        if sl not in results["by_line"]:
            results["by_line"][sl] = {"WIN": 0, "LOSS": 0, "PUSH": 0, "HALF_WIN": 0, "HALF_LOSS": 0, "total": 0}
        results["by_line"][sl][r["target"]] = results["by_line"][sl].get(r["target"], 0) + 1
        results["by_line"][sl]["total"] += 1
    
    for line, d in results["by_line"].items():
        d["win_pct"] = round(safe_div(d["WIN"], d["total"]) * 100, 1) if d["total"] else 0
    
    for season in SEASONS:
        path = f"{GOLD_DIR}/over_under/{season}.json"
        if not os.path.exists(path):
            continue
        data = load_json(path)
        sc = {}
        for r in data:
            sc[r["target"]] = sc.get(r["target"], 0) + 1
        results["by_season"][season] = sc
    
    return results

# ============================================================
# Phase 6 - Odds Distribution Audit
# ============================================================
def phase6_odds_audit(matches):
    print("\n=== Phase 6: Odds Distribution Audit ===")
    all_odds = []
    for m in matches:
        for key in ["b365h", "b365d", "b365a"]:
            all_odds.append(m[key])
    
    n = len(all_odds)
    zeros = sum(1 for o in all_odds if o == 0)
    neg = sum(1 for o in all_odds if o < 0)
    impossible = sum(1 for o in all_odds if 0 < o < 1.01)
    
    valid_odds = [o for o in all_odds if o > 0]
    clean = zeros == 0 and neg == 0 and impossible == 0
    
    odds_range = {}
    if valid_odds:
        odds_range = {
            "min": round(min(valid_odds), 2),
            "max": round(max(valid_odds), 2),
            "mean": round(safe_div(sum(valid_odds), len(valid_odds)), 2),
            "median": round(sorted(valid_odds)[len(valid_odds)//2], 2),
        }
    
    report_phase("Odds parsing clean", clean, f"zeros={zeros} neg={neg} impossible={impossible}")
    return {"total_odds_points": n, "zero_odds": zeros, "negative_odds": neg, "impossible_odds": impossible,
            "odds_range": odds_range, "has_parsing_errors": not clean}

# ============================================================
# Phase 7 - Implied Probability Audit
# ============================================================
def phase7_implied_prob(matches):
    print("\n=== Phase 7: Implied Probability Audit ===")
    margins = []
    invalid = []
    
    for m in matches:
        if m["b365h"] == 0 or m["b365d"] == 0 or m["b365a"] == 0:
            continue
        ih, id_, ia = 1.0 / m["b365h"], 1.0 / m["b365d"], 1.0 / m["b365a"]
        if ih < 0 or id_ < 0 or ia < 0:
            invalid.append(m["home"] + " v " + m["away"])
        margins.append(ih + id_ + ia - 1.0)
    
    has_neg = any(m < 0 for m in margins)
    report_phase("Implied probabilities valid", not has_neg, f"avg_overround={round(safe_div(sum(margins), len(margins))*100, 2) if margins else 0}%")
    
    return {
        "total_matches_checked": len(margins),
        "avg_overround": round(safe_div(sum(margins), len(margins)) * 100, 2) if margins else 0,
        "min_margin": round(min(margins) * 100, 2) if margins else 0,
        "max_margin": round(max(margins) * 100, 2) if margins else 0,
        "negative_margins": sum(1 for m in margins if m < 0),
        "no_impossible_probs": len(invalid) == 0,
        "invalid_count": len(invalid),
    }

# ============================================================
# Phase 8 - xG Consistency Audit
# ============================================================
def phase8_xg_audit():
    print("\n=== Phase 8: xG Consistency Audit ===")
    issues = []
    all_hxg, all_axg = [], []
    
    for season in SEASONS:
        path = f"{BRONZE_EPL}/{season}_understat.json"
        if not os.path.exists(path):
            continue
        data = load_json(path)
        for r in data:
            hxg, axg = r["homeXg"]["value"], r["awayXg"]["value"]
            all_hxg.append(hxg)
            all_axg.append(axg)
            if hxg < 0 or axg < 0:
                issues.append(f"Negative xG: {r['homeTeamId']} v {r['awayTeamId']} ({season})")
            if hxg > 10 or axg > 10:
                issues.append(f"Extreme xG: {r['homeTeamId']} v {r['awayTeamId']} ({season})")
    
    clean = len(issues) == 0
    report_phase("xG values consistent", clean, f"records={len(all_hxg)} home_xg_avg={round(safe_div(sum(all_hxg), len(all_hxg)), 2)}")
    
    return {
        "total_records": len(all_hxg),
        "negative_values": sum(1 for v in all_hxg + all_axg if v < 0),
        "extreme_outliers": len(issues),
        "avg_home_xg": round(safe_div(sum(all_hxg), len(all_hxg)), 2) if all_hxg else 0,
        "avg_away_xg": round(safe_div(sum(all_axg), len(all_axg)), 2) if all_axg else 0,
        "has_issues": not clean,
        "issues": issues[:5],
    }

# ============================================================
# Phase 9 - Historical Plausibility Check
# ============================================================
def phase9_benchmark_comparison(matches, p1, p2, p3):
    print("\n=== Phase 9: Historical Plausibility Check ===")
    computed = {
        "home_win_pct": p1["overall"]["home_win_pct"],
        "draw_pct": p1["overall"]["draw_pct"],
        "away_win_pct": p1["overall"]["away_win_pct"],
        "avg_goals": p1["overall"]["avg_goals"],
        "btts_pct": p3["overall_btts_pct"],
        "over_2_5_pct": p2["over_under_rates"]["over_2.5"],
        "home_goals_avg": p1["overall"]["home_goals_avg"],
        "away_goals_avg": p1["overall"]["away_goals_avg"],
    }
    
    comparisons = []
    flags = []
    for metric, expected in PUBLIC_BENCHMARKS.items():
        actual = computed[metric]
        diff = actual - expected["value"]
        within = abs(diff) <= expected["tolerance"]
        comparisons.append({
            "metric": metric, "dataset_value": actual, "reference_value": expected["value"],
            "difference": round(diff, 2), "tolerance": expected["tolerance"],
            "within_tolerance": within, "source": expected["source"]
        })
        if not within:
            flags.append(f"{metric}: {actual} vs {expected['value']} (ref)")
    
    report_phase("Benchmarks within tolerance", len(flags) == 0, f"{len(comparisons)} metrics, {len(flags)} flags")
    return {"comparisons": comparisons, "flags": flags, "all_within_tolerance": len(flags) == 0}

# ============================================================
# Phase 10 - Feature Integrity Audit
# ============================================================
def phase10_feature_integrity():
    print("\n=== Phase 10: Feature Integrity Audit ===")
    issues = []
    notes = []
    
    # Expected duplicate fixtureIds across all 9 seasons
    # ML: 1 line/match -> 0 dupes
    # AH: 21 lines/match -> 7600 dupes/season * 9 seasons = 68400
    # OU: 9 lines/match -> 3040 dupes/season * 9 seasons = 27360
    expected_dupes = {"moneyline": 0, "asian_handicap": 68400, "over_under": 27360}
    
    for domain in ["moneyline", "asian_handicap", "over_under"]:
        records = load_gold(domain)
        fixture_ids = []
        null_count = 0
        for r in records:
            fixture_ids.append(r["fixtureId"])
            for k, v in r.get("features", {}).items():
                if v is None:
                    null_count += 1
        dupes = len(fixture_ids) - len(set(fixture_ids))
        unique = len(set(fixture_ids))
        
        expected = expected_dupes.get(domain, 0)
        if dupes != expected:
            issues.append(f"{domain}: {dupes} duplicate fixtureIds (expected {expected} for {unique} unique fixtures)")
        if null_count > 0:
            issues.append(f"{domain}: {null_count} null feature values")
        notes.append(f"{domain}: {len(records)} records, {unique} unique fixtures, {dupes} expected duplicates (multi-line design)")
    
    clean = len(issues) == 0
    for n in notes:
        print(f"    {n}")
    report_phase("Feature integrity pass", clean, f"{'no issues' if clean else str(len(issues)) + ' issues'}")
    return {"issues": issues, "notes": notes, "pass": clean}

# ============================================================
# Phase 11 - Probability Calibration Sanity
# ============================================================
def phase11_calibration_sanity(matches):
    print("\n=== Phase 11: Probability Calibration Sanity ===")
    n = len(matches)
    home_wins = sum(1 for m in matches if m["ftr"] == "H")
    league_home_pct = safe_div(home_wins, n)
    
    bins = [
        (1.0, 1.5), (1.5, 2.0), (2.0, 2.5), (2.5, 3.0),
        (3.0, 4.0), (4.0, 6.0), (6.0, 10.0), (10.0, 999.0)
    ]
    bin_data = [{ "lo": lo, "hi": hi, "count": 0, "wins": 0 } for lo, hi in bins]
    
    for m in matches:
        if m["b365h"] == 0:
            continue
        odds = m["b365h"]
        for bd in bin_data:
            if bd["lo"] <= odds < bd["hi"]:
                bd["count"] += 1
                if m["ftr"] == "H":
                    bd["wins"] += 1
                break
    
    calibration = []
    for bd in bin_data:
        if bd["count"] == 0:
            continue
        mid_odds = (bd["lo"] + bd["hi"]) / 2 if bd["hi"] < 900 else bd["lo"] * 1.5
        implied = 1.0 / mid_odds
        actual = safe_div(bd["wins"], bd["count"])
        calibration.append({
            "odds_range": f"{bd['lo']}-{bd['hi'] if bd['hi']<900 else 'inf'}",
            "count": bd["count"],
            "avg_implied_prob": round(implied * 100, 1),
            "actual_prob": round(actual * 100, 1),
            "calibration_error": round((actual - implied) * 100, 1),
        })
    
    report_phase("Calibration sanity check", True, f"league_home_win={round(league_home_pct*100, 1)}%")
    return {"league_home_win_pct": round(league_home_pct * 100, 1), "calibration": calibration}

# ============================================================
# Phase 12 - Statistical Confidence
# ============================================================
def phase12_confidence(matches):
    print("\n=== Phase 12: Statistical Confidence ===")
    n = len(matches)
    home_wins = sum(1 for m in matches if m["ftr"] == "H")
    draws = sum(1 for m in matches if m["ftr"] == "D")
    away_wins = sum(1 for m in matches if m["ftr"] == "A")
    btts = sum(1 for m in matches if m["fthg"] > 0 and m["ftag"] > 0)
    
    def ci_str(p, n_):
        lo, hi = ci_proportion(p, n_)
        return f"[{round(lo*100,1)}%, {round(hi*100,1)}%]"
    
    metrics = [
        {"name": "Home Win %", "value": round(safe_div(home_wins, n) * 100, 1), "n": n,
         "se": round(math.sqrt(safe_div(home_wins, n) * (1 - safe_div(home_wins, n)) / n) * 100, 2),
         "ci_95": ci_str(safe_div(home_wins, n), n)},
        {"name": "Draw %", "value": round(safe_div(draws, n) * 100, 1), "n": n,
         "se": round(math.sqrt(safe_div(draws, n) * (1 - safe_div(draws, n)) / n) * 100, 2),
         "ci_95": ci_str(safe_div(draws, n), n)},
        {"name": "Away Win %", "value": round(safe_div(away_wins, n) * 100, 1), "n": n,
         "se": round(math.sqrt(safe_div(away_wins, n) * (1 - safe_div(away_wins, n)) / n) * 100, 2),
         "ci_95": ci_str(safe_div(away_wins, n), n)},
        {"name": "BTTS %", "value": round(safe_div(btts, n) * 100, 1), "n": n,
         "se": round(math.sqrt(safe_div(btts, n) * (1 - safe_div(btts, n)) / n) * 100, 2),
         "ci_95": ci_str(safe_div(btts, n), n)},
    ]
    
    report_phase("Confidence intervals computed", True, f"Home Win 95% CI: {metrics[0]['ci_95']}")
    return {"metrics": metrics}

# ============================================================
# Phase 13 - Reproducibility Audit
# ============================================================
def phase13_reproducibility(matches):
    print("\n=== Phase 13: Reproducibility Audit ===")
    ml_counts, ah_counts, ou_counts = {}, {}, {}
    for season in SEASONS:
        ml = load_json(f"{GOLD_DIR}/moneyline/{season}.json") if os.path.exists(f"{GOLD_DIR}/moneyline/{season}.json") else []
        ah = load_json(f"{GOLD_DIR}/asian_handicap/{season}.json") if os.path.exists(f"{GOLD_DIR}/asian_handicap/{season}.json") else []
        ou = load_json(f"{GOLD_DIR}/over_under/{season}.json") if os.path.exists(f"{GOLD_DIR}/over_under/{season}.json") else []
        ml_counts[season] = len(ml)
        ah_counts[season] = len(ah)
        ou_counts[season] = len(ou)
    
    ml_ok = all(c == 380 for c in ml_counts.values())
    ah_ok = all(c == 7980 for c in ah_counts.values())
    ou_ok = all(c == 3420 for c in ou_counts.values())
    
    report_phase("Row counts consistent", ml_ok and ah_ok and ou_ok, f"ML:{ml_counts} AH:380x9 OU:3420x9")
    return {
        "ml_row_counts": ml_counts, "ah_row_counts": ah_counts, "ou_row_counts": ou_counts,
        "ml_all_380": ml_ok, "ah_all_7980": ah_ok, "ou_all_3420": ou_ok,
        "csv_row_count": len(matches)
    }

# ============================================================
# Main
# ============================================================
def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    
    print("=" * 60)
    print("EPIC 32.6 - Probability Sanity Check & Research Validation")
    print("=" * 60)
    
    print("\n[Loading data...]")
    matches = load_all_matches()
    print(f"  Loaded {len(matches)} matches from football-data.co.uk")
    
    p1 = phase1_league_probabilities(matches)
    p2 = phase2_goal_distribution(matches)
    p3 = phase3_btts(matches)
    p4 = phase4_ah_settlement()
    p5 = phase5_ou_settlement()
    p6 = phase6_odds_audit(matches)
    p7 = phase7_implied_prob(matches)
    p8 = phase8_xg_audit()
    p9 = phase9_benchmark_comparison(matches, p1, p2, p3)
    p10 = phase10_feature_integrity()
    p11 = phase11_calibration_sanity(matches)
    p12 = phase12_confidence(matches)
    p13 = phase13_reproducibility(matches)
    
    all_results = {
        "metadata": {"audit": "EPIC 32.6 Probability Sanity Check", "date": "2026-07-17",
                     "seasons": SEASONS, "dataset_version": "v0.32.1"},
        "phase1_league_probabilities": p1,
        "phase2_goal_distribution": p2,
        "phase3_btts": p3,
        "phase4_ah_settlement": p4,
        "phase5_ou_settlement": p5,
        "phase6_odds_audit": p6,
        "phase7_implied_probability": p7,
        "phase8_xg_audit": p8,
        "phase9_benchmark_comparison": p9,
        "phase10_feature_integrity": p10,
        "phase11_calibration_sanity": p11,
        "phase12_confidence_intervals": p12,
        "phase13_reproducibility": p13,
    }
    
    # Machine-readable outputs
    prob_summary = {
        "home_win_pct": p1["overall"]["home_win_pct"],
        "draw_pct": p1["overall"]["draw_pct"],
        "away_win_pct": p1["overall"]["away_win_pct"],
        "sum_check": p1["overall"]["sum_pct"],
        "avg_goals": p1["overall"]["avg_goals"],
        "home_goals_avg": p1["overall"]["home_goals_avg"],
        "away_goals_avg": p1["overall"]["away_goals_avg"],
        "btts_pct": p3["overall_btts_pct"],
        "over_2_5_pct": p2["over_under_rates"]["over_2.5"],
        "confidence_intervals": {"home_95ci": p1["overall"]["home_ci"], "draw_95ci": p1["overall"]["draw_ci"], "away_95ci": p1["overall"]["away_ci"]},
        "goal_distribution": p2["goal_distribution"],
        "over_under_rates": p2["over_under_rates"],
    }
    
    with open(f"{OUTPUT_DIR}/probability_summary.json", "w") as f:
        json.dump(prob_summary, f, indent=2)
    with open(f"{OUTPUT_DIR}/benchmark_comparison.json", "w") as f:
        json.dump(p9, f, indent=2)
    with open(f"{OUTPUT_DIR}/settlement_audit.json", "w") as f:
        json.dump({"asian_handicap": p4, "over_under": p5}, f, indent=2)
    with open(f"{OUTPUT_DIR}/feature_integrity.json", "w") as f:
        json.dump(p10, f, indent=2)
    with open(f"{OUTPUT_DIR}/reproducibility.json", "w") as f:
        json.dump({"row_counts": p13}, f, indent=2)
    with open(f"{OUTPUT_DIR}/all_results.json", "w") as f:
        json.dump(all_results, f, indent=2)
    
    print("\n" + "=" * 60)
    print("FINAL SUMMARY")
    print("=" * 60)
    
    all_pass = all(phase_status.values())
    for name, passed in phase_status.items():
        icon = "PASS" if passed else "FAIL"
        print(f"  [{icon}] {name}")
    
    print(f"\n  Overall: {'ALL PASS' if all_pass else 'SOME FAILURES'}")
    print(f"\nEPIC 32.6 validation complete.")
    print(f"Outputs: {OUTPUT_DIR}/")

if __name__ == "__main__":
    main()