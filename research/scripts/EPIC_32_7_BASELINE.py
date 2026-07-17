#!/usr/bin/env python3
"""
EPIC 32.7 — Baseline Scoreboard Generator

Computes baseline prediction scores from historical EPL data.
Compares: Random, Always Home, League Average, xG Only, Odds Only, ELO

Output: research/BASELINE_SCOREBOARD.md

Usage: python -X utf8 research/scripts/EPIC_32_7_BASELINE.py
"""

import json
import os
import math
import csv

SEASONS = ["2015-2016","2016-2017","2017-2018","2018-2019","2019-2020",
           "2020-2021","2021-2022","2022-2023","2023-2024"]
BRONZE_FD = "data/bronze/football_data"
BRONZE_EPL = "data/bronze/EPL"
OUTPUT_FILE = "research/BASELINE_SCOREBOARD.md"

def safe_div(a, b):
    return a / b if b > 0 else 0.0

def load_matches():
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

def compute_brier(probs, outcomes):
    n = len(probs)
    if n == 0:
        return 0.0
    return sum((p - o)**2 for p, o in zip(probs, outcomes)) / n

def compute_logloss(probs, outcomes, eps=1e-15):
    n = len(probs)
    if n == 0:
        return 0.0
    probs = [max(eps, min(1-eps, p)) for p in probs]
    return -sum(o * math.log(p) + (1-o) * math.log(1-p) for p, o in zip(probs, outcomes)) / n

def compute_roi(odds, outcomes, stake=1.0):
    n = len(odds)
    if n == 0:
        return 0.0
    total_stake = n * stake
    total_return = sum((odds[i] * stake) if outcomes[i] == 1 else 0 for i in range(n))
    return (total_return - total_stake) / total_stake * 100

def normalize_team(name):
    """Normalize team name from CSV format to Understat format."""
    return name.lower().replace(" ", "").replace("'", "").replace("-", "")

def compute_baselines(matches):
    n = len(matches)
    results = {}
    
    home_outcomes = [1 if m["ftr"] == "H" else 0 for m in matches]
    draw_outcomes = [1 if m["ftr"] == "D" else 0 for m in matches]
    away_outcomes = [1 if m["ftr"] == "A" else 0 for m in matches]
    
    league_home = safe_div(sum(home_outcomes), n)
    league_draw = safe_div(sum(draw_outcomes), n)
    league_away = safe_div(sum(away_outcomes), n)
    
    # 1. Random
    random_brier = league_home * (1 - league_home) + league_draw * (1 - league_draw) + league_away * (1 - league_away)
    random_ll = -(league_home * math.log(league_home) + league_draw * math.log(league_draw) + league_away * math.log(league_away))
    results["Random"] = {"brier": round(random_brier, 4), "logloss": round(random_ll, 4), "roi": 0.0}
    
    # 2. Always Home
    ah_roi = compute_roi([m["b365h"] for m in matches], home_outcomes)
    results["Always Home"] = {"brier": round(compute_brier([1.0]*n, home_outcomes), 4),
                              "logloss": round(compute_logloss([1.0]*n, home_outcomes), 4),
                              "roi": round(ah_roi, 1)}
    
    # 3. Always Draw
    results["Always Draw"] = {"brier": round(compute_brier([1.0]*n, draw_outcomes), 4),
                              "logloss": round(compute_logloss([1.0]*n, draw_outcomes), 4),
                              "roi": round(compute_roi([m["b365d"] for m in matches], draw_outcomes), 1)}
    
    # 4. Always Away
    results["Always Away"] = {"brier": round(compute_brier([1.0]*n, away_outcomes), 4),
                              "logloss": round(compute_logloss([1.0]*n, away_outcomes), 4),
                              "roi": round(compute_roi([m["b365a"] for m in matches], away_outcomes), 1)}
    
    # 5. League Average
    la_brier = sum((league_home - home_outcomes[i])**2 + (league_draw - draw_outcomes[i])**2 + (league_away - away_outcomes[i])**2 for i in range(n)) / n
    la_ll = sum(
        -(home_outcomes[i] * math.log(max(1e-15, league_home)) +
          draw_outcomes[i] * math.log(max(1e-15, league_draw)) +
          away_outcomes[i] * math.log(max(1e-15, league_away)))
        for i in range(n)
    ) / n
    results["League Average"] = {"brier": round(la_brier, 4), "logloss": round(la_ll, 4), "roi": "N/A"}
    
    # 6. Odds Only
    valid_matches = [(i, m) for i, m in enumerate(matches) if m["b365h"] > 0 and m["b365d"] > 0 and m["b365a"] > 0]
    oo_probs, oo_outs, oo_odds = [], [], []
    for _, m in valid_matches:
        total = 1.0/m["b365h"] + 1.0/m["b365d"] + 1.0/m["b365a"]
        oo_probs.append((1.0/m["b365h"]) / total)
        oo_outs.append(1 if m["ftr"] == "H" else 0)
        oo_odds.append(m["b365h"])
    results["Odds Only"] = {"brier": round(compute_brier(oo_probs, oo_outs), 4),
                            "logloss": round(compute_logloss(oo_probs, oo_outs), 4),
                            "roi": round(compute_roi(oo_odds, oo_outs), 1)}
    
    # 7. Load Understat xG data
    xg_lookup = {}  # (season, home_team_norm) -> (hxg, axg)
    for season in SEASONS:
        path = f"{BRONZE_EPL}/{season}_understat.json"
        if os.path.exists(path):
            with open(path) as f:
                for rec in json.load(f):
                    key = (rec["seasonId"], rec["homeTeamId"])
                    xg_lookup[key] = (rec["homeXg"]["value"], rec["awayXg"]["value"])
    
    # Build xG predictions and ELO simultaneously
    elo_ratings = {}
    elo_preds, elo_outs, elo_bets, elo_bet_outs = [], [], [], []
    xg_preds, xg_outs = [], []
    
    for m in matches:
        h, a = m["home"], m["away"]
        
        # ELO
        if h not in elo_ratings: elo_ratings[h] = 1500
        if a not in elo_ratings: elo_ratings[a] = 1500
        e_h = 1.0 / (1.0 + 10.0 ** ((elo_ratings[a] - (elo_ratings[h] + 50)) / 400.0))
        elo_preds.append(e_h)
        elo_outs.append(1 if m["ftr"] == "H" else 0)
        
        s_h = 1.0 if m["ftr"] == "H" else 0.5 if m["ftr"] == "D" else 0.0
        s_a = 1.0 - s_h if m["ftr"] != "D" else 0.5
        K = 32
        elo_ratings[h] += K * (s_h - e_h)
        elo_ratings[a] += K * (s_a - (1 - e_h))
        
        if e_h > 0.55 and m["b365h"] > 0:
            elo_bets.append(m["b365h"])
            elo_bet_outs.append(1 if m["ftr"] == "H" else 0)
        
        # xG
        norm_h = normalize_team(h)
        xg_key = (m["season"], norm_h)
        if xg_key in xg_lookup:
            hxg, axg = xg_lookup[xg_key]
            xg_diff = hxg - axg
            p_h = 1.0 / (1.0 + math.exp(-1.5 * xg_diff))
            p_h = max(0.05, min(0.95, p_h))
            xg_preds.append(p_h)
            xg_outs.append(1 if m["ftr"] == "H" else 0)
    
    # 7. xG Only
    if xg_preds:
        xg_brier = compute_brier(xg_preds, xg_outs)
        xg_ll = compute_logloss(xg_preds, xg_outs)
        xg_bets = []
        xg_bet_outs = []
        # Match xG predictions to valid_matches for betting
        for i, (_, m) in enumerate(valid_matches):
            norm_h = normalize_team(m["home"])
            xg_key = (m["season"], norm_h)
            if xg_key in xg_lookup:
                hxg, axg = xg_lookup[xg_key]
                p_h = 1.0 / (1.0 + math.exp(-1.5 * (hxg - axg)))
                p_h = max(0.05, min(0.95, p_h))
                if p_h > 0.5:
                    xg_bets.append(m["b365h"])
                    xg_bet_outs.append(1 if m["ftr"] == "H" else 0)
        xg_roi = compute_roi(xg_bets, xg_bet_outs) if xg_bets else 0.0
        results["xG Only"] = {"brier": round(xg_brier, 4), "logloss": round(xg_ll, 4),
                              "roi": round(xg_roi, 1), "n_bets": len(xg_bets)}
    else:
        results["xG Only"] = {"brier": 0.0, "logloss": 0.0, "roi": 0.0, "note": "No xG data matched"}
    
    # 8. ELO
    elo_brier = compute_brier(elo_preds, elo_outs)
    elo_ll = compute_logloss(elo_preds, elo_outs)
    elo_roi = compute_roi(elo_bets, elo_bet_outs) if elo_bets else 0.0
    results["ELO"] = {"brier": round(elo_brier, 4), "logloss": round(elo_ll, 4),
                      "roi": round(elo_roi, 1), "n_bets": len(elo_bets)}
    
    # 9. ELO + xG Ensemble
    if xg_preds:
        n_ens = min(len(xg_preds), len(elo_preds))
        ensemble = [0.5 * xg_preds[i] + 0.5 * elo_preds[i] for i in range(n_ens)]
        ens_brier = compute_brier(ensemble, elo_outs[:n_ens])
        ens_ll = compute_logloss(ensemble, elo_outs[:n_ens])
        ens_bets, ens_bet_outs = [], []
        for i, (_, m) in enumerate(valid_matches):
            if i < n_ens and ensemble[i] > 0.55 and m["b365h"] > 0:
                ens_bets.append(m["b365h"])
                ens_bet_outs.append(1 if m["ftr"] == "H" else 0)
        ens_roi = compute_roi(ens_bets, ens_bet_outs) if ens_bets else 0.0
        results["ELO + xG"] = {"brier": round(ens_brier, 4), "logloss": round(ens_ll, 4),
                               "roi": round(ens_roi, 1), "n_bets": len(ens_bets)}
    
    return results, n

def main():
    print("Generating Baseline Scoreboard...")
    matches = load_matches()
    print(f"  Loaded {len(matches)} matches")
    
    results, n = compute_baselines(matches)
    r = results
    
    md = f"""# Baseline Scoreboard — Pre-EPIC 33

**Dataset**: EPL {SEASONS[0]} through {SEASONS[-1]} ({n} fixtures)
**Generated**: 2026-07-17
**Script**: `research/scripts/EPIC_32_7_BASELINE.py`

---

## Predictors Compared

| # | Predictor | Description |
|:-:|-----------|-------------|
| 1 | **Random** | Always predicts league-average probabilities |
| 2 | **Always Home** | Predicts home win with 100% confidence for every match |
| 3 | **Always Draw** | Predicts draw with 100% confidence for every match |
| 4 | **Always Away** | Predicts away win with 100% confidence for every match |
| 5 | **League Average** | Uses fixed seasonal probabilities as predictions |
| 6 | **Odds Only** | Uses Bet365 normalized implied probabilities |
| 7 | **xG Only** | Logistic function of xG differential (k=1.5) |
| 8 | **ELO** | Sequential ELO ratings (K=32, home adv=50) |
| 9 | **ELO + xG** | Equal-weighted ensemble of ELO and xG |

---

## Scoreboard

| Predictor | Brier ↓ | LogLoss ↓ | ROI % ↑ | n(Bets) |
|-----------|:-------:|:---------:|:-------:|:-------:|
| Random | `{r['Random']['brier']}` | `{r['Random']['logloss']}` | {r['Random']['roi']}% | — |
| Always Home | `{r['Always Home']['brier']}` | `{r['Always Home']['logloss']}` | `{r['Always Home']['roi']}%` | {n} |
| Always Draw | `{r['Always Draw']['brier']}` | `{r['Always Draw']['logloss']}` | `{r['Always Draw']['roi']}%` | {n} |
| Always Away | `{r['Always Away']['brier']}` | `{r['Always Away']['logloss']}` | `{r['Always Away']['roi']}%` | {n} |
| League Average | `{r['League Average']['brier']}` | `{r['League Average']['logloss']}` | {r['League Average']['roi']} | — |
| **Odds Only** | `{r['Odds Only']['brier']}` | `{r['Odds Only']['logloss']}` | `{r['Odds Only']['roi']}%` | {n} |
| **xG Only** | `{r['xG Only']['brier']}` | `{r['xG Only']['logloss']}` | `{r['xG Only']['roi']}%` | {r['xG Only'].get('n_bets', '—')} |
| **ELO** | `{r['ELO']['brier']}` | `{r['ELO']['logloss']}` | `{r['ELO']['roi']}%` | {r['ELO']['n_bets']} |
"""

    if 'ELO + xG' in r:
        md += f"""| **ELO + xG** | `{r['ELO + xG']['brier']}` | `{r['ELO + xG']['logloss']}` | `{r['ELO + xG']['roi']}%` | {r['ELO + xG']['n_bets']} |\n"""
    
    md += f"""
> Brier = Mean Squared Error (lower is better, 0 = perfect)
> LogLoss = Cross-entropy (lower is better)
> ROI % = Flat-stake return on Bet365 odds (higher is better)

---

## Key Insights

### 1. Odds Only is the hardest baseline to beat
The Bet365 market encodes crowd wisdom. Any ML model must beat:
- Brier < `{r['Odds Only']['brier']}`
- LogLoss < `{r['Odds Only']['logloss']}`
- ROI > `{r['Odds Only']['roi']}%`

### 2. ELO is surprisingly competitive
Simple ELO (K=32) achieves Brier `{r['ELO']['brier']}` with almost no data preprocessing.

### 3. League Average is the "no-information" baseline
Brier `{r['League Average']['brier']}` — any useful model must beat this trivially.

### 4. Always strategies have terrible LogLoss
Predicting 100% confidence on wrong outcomes incurs severe log loss penalty.

---

## Acceptance Criteria for EPIC 33

A model in EPIC 33 must demonstrate **ALL** of:

1. ✅ Brier Score better than **Odds Only** (`{r['Odds Only']['brier']}`)
2. ✅ LogLoss better than **Odds Only** (`{r['Odds Only']['logloss']}`)"""

    if 'ELO + xG' in r:
        md += f"""
3. ✅ ROI higher than **ELO + xG** (`{r['ELO + xG']['roi']}%`)"""
    else:
        md += f"""
3. ✅ ROI higher than **ELO** (`{r['ELO']['roi']}%`)"""

    md += f"""
4. ✅ Outperforms every simple baseline listed above
5. ✅ Improvement is statistically significant (test set n ≥ 500)

---

## Methodology Notes

- **Brier Score**: Multi-class for Random/League Average, binary (home win) for others  
- **ROI**: Flat stake ($1), Bet365 closing odds. Draw/away bets not modeled separately  
- **ELO**: Initial rating 1500, K=32, home advantage=50, sequentially updated  
- **xG**: Logistic function P(home) = 1/(1 + exp(-1.5 × xG_diff))  
- **Odds**: Implied probabilities normalized by removing overround  
- **Evaluated on**: {n} EPL matches, 9 seasons
"""

    with open(OUTPUT_FILE, "w") as f:
        f.write(md)
    
    print(f"\nBaseline Scoreboard written to {OUTPUT_FILE}")
    print(f"\nResults:")
    for name, val in results.items():
        print(f"  {name:20s} Brier={val['brier']:.4f}  LogLoss={val['logloss']:.4f}  ROI={val['roi']}%")

if __name__ == "__main__":
    main()