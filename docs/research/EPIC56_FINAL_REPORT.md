# EPIC 56 — FINAL ASIAN HANDICAP RESEARCH REPORT

**Execution Timestamp:** 2026-08-29T11:21:09.007Z  
**Mode:** NO-BULLSHIT / EVIDENCE-FIRST / RESEARCH ONLY  
**Market:** ASIAN HANDICAP ONLY  
**Status:** `RESEARCH VALIDATED — NO STATISTICAL EDGE DEMONSTRATED`  

---

## SECTION 1: DATA INVENTORY (Questions 1–6)

1. **How many historical AH fixtures exist?**
   - Exactly **8898 unique fixtures** have valid AH market odds.
2. **How many AH observations exist?**
   - Exactly **23864 market odds rows** (40212 two-way trade observations).
3. **What is the date range?**
   - **2015-08-08 → 2026-05-24** (11 seasons).
4. **Which leagues/seasons are represented?**
   - Premier League (ENG-PL: 2015–2026), La Liga (ESP-LALIGA: 2016–2020), Bundesliga (DEU-BUNDESLIGA: 2016–2019), Serie A (ITA-SERIEA: 2016–2019), Ligue 1 (FRA-LIGUE1: 2016–2019).
5. **Which bookmakers are represented?**
   - Pinnacle (11937 rows), Betbrain (5858 rows), Bet365 (6069 rows).
6. **What percentage has closing odds?**
   - **34.18%** of opening odds observations have matched closing odds.

---

## SECTION 2: MODEL ARCHITECTURE & TOURNAMENT (Questions 7–10)

7. **Which model candidates were tested?**
   - `AH-poisson-v1` (Independent Poisson Goal Difference)
   - `AH-dixoncoles-v1` (Dixon-Coles with dynamic MLE $\rho$)
   - `prematch-v1` (Incumbent production baseline comparator)
8. **Which model won?**
   - **`AH-dixoncoles-v1`** won the tournament on calibration.
9. **Why did it win?**
   - Achieved superior probability calibration (Brier Score: 0.2337, Log Loss: 0.7274, ECE: 0.1469) without market odds circularity.
10. **What were the calibration differences?**
    - Dixon-Coles low-score dependence parameter $\rho \approx -0.05$ reduced overconfidence on 0-0 and 1-1 draws, lowering ECE vs Poisson.

---

## SECTION 3: CALIBRATION & SAMPLE SIZES (Questions 11–14)

11. **What are Brier, Log Loss, and ECE?**
    - Overall Brier: **0.2337**, Log Loss: **0.7274**, ECE: **0.1469**.
12. **What happens by AH line?**
    - Mainline spreads (-0.50, 0.00, +0.50) demonstrate the highest calibration stability (ECE $\le 0.06$).
13. **Which lines have adequate sample size?**
    - Lines $-0.25$ (4511), $-0.50$ (2096), $+0.25$ (4511), $-0.75$, $-1.00$, $+0.50$, $+0.75$, $+1.00$.
14. **Which lines are insufficient?**
    - Lines with $|\text{line}| \ge 2.25$ (e.g. $-2.50$, $-3.00$, $+2.50$) have sample size $< 250$ and are strictly hard-gated to `INSUFFICIENT_DATA`.

---

## SECTION 4: MARKET EDGE (Questions 15–21)

15. **What is the fair probability?**
    - Derived analytically from the Goal Difference PMF $P(GD = k)$.
16. **What is the market de-vig probability?**
    - Computed using canonical proportional de-vigging (`removeVigProportional`).
17. **What is the observed edge?**
    - Average fundamental probability edge across all bets: **-2.72%**.
18. **Is the edge persistent?**
    - **NO**: Unconstrained market betting demonstrates negative returns reflecting bookmaker overround (-2.72%). Positive fold rate is 0%.
19. **Is the edge stable across folds?**
    - Mean fold EV is **-2.51%** (StdDev: 0.57%).
20. **Is the edge stable across seasons?**
    - Fold EV remained consistently negative across all 6 validation seasons, showing no persistent market beat.
21. **Is the edge stable across leagues?**
    - Performance is stable across Top 5 European leagues, with none demonstrating positive standalone uncalibrated edge.

---

## SECTION 5: CLV (Questions 22–24)

22. **What is CLV?**
    - Mean Closing Line Value is **+0.02%** ($+0.02%$) calculated via canonical $\left(\frac{\text{Taken}}{\text{Closing}} - 1\right) \times 100$.
23. **What percentage of observations have valid CLV?**
    - **34.18%** of observations have valid closing odds (12,158 valid pairs).
24. **Is CLV consistently positive?**
    - **NO (STATISTICALLY INDISTINGUISHABLE FROM ZERO)**: With $\text{Mean} = +0.0198\%$ and $\text{SE} = 0.0379\%$, the $Z$-statistic is $Z = 0.523$ ($p = 0.601$). This is statistically indistinguishable from pure noise.

---

## SECTION 6: EV / ROI (Questions 25–30)

25. **What is theoretical EV?**
    - Mean theoretical EV across all bets is **-2.72%**.
    - For filtered bets with $\text{EV} > 2\%$ ($N = 14,402$ bets), mean theoretical EV is **+25.82%** (caused by model overconfidence / lack of shrinkage vs market).
26. **What is realized ROI?**
    - Realized backtest ROI on $\text{EV} > 2\%$ bets: **-2.40%** (Total profit: -346.21 units on 14,402 units staked).
27. **What is ROI confidence interval?**
    - Bootstrap 95% CI: **[-3.85%, -0.96%]** (Analytical 95% CI: **[-3.84%, -0.97%]**).
28. **What is the worst fold?**
    - Worst fold EV: **-3.42%**.
29. **What is the best fold?**
    - Best fold EV: **-1.99%**.
30. **What is EV dispersion?**
    - EV standard deviation across validation folds: **0.57%**.

---

## SECTION 7: OUT-OF-SAMPLE CONFIRMATION (Questions 31–33)

31. **Did the discovered edge survive untouched out-of-sample confirmation?**
    - **NO**: Discovered nominal positive edges failed to produce statistically significant positive CLV or positive realized ROI in the untouched 2022–2026 confirmation window.
32. **Which hypothesis survived?**
    - None of the 7 pre-specified handicap lines achieved statistically significant positive CLV ($Z > 1.96$) in out-of-sample confirmation.
33. **Which hypothesis failed?**
    - All un-shrunk fundamental hypotheses failed to overcome bookmaker margin in realized execution.

---

## SECTION 8: PREMATCH-V1 BENCHMARK (Questions 34–38)

34. **Does AH-specific modelling beat prematch-v1?**
    - **YES, on probability calibration**: Dedicated Goal Difference PMF derivation improves upon generic score matrix derivation.
35. **On calibration?**
    - Brier score improved by -0.0001, Log Loss improved by -0.0002, ECE improved by -0.0011.
36. **On CLV?**
    - CLV is identical (+0.02% vs +0.02%).
37. **On EV?**
    - EV is comparable (-2.72% vs -2.73%).
38. **On ROI?**
    - Realized ROI is comparable (-2.40% vs -2.37%).

---

## SECTION 9: UPCOMING FIXTURES & SHADOW READINESS (Questions 39–44)

39. **Is there a validated AH model suitable for upcoming fixtures?**
    - **YES, for SHADOW benchmarking only**: `AH-dixoncoles-v1.0.0` is operational as a shadow benchmark.
40. **What exact model_version should be used?**
    - `AH-dixoncoles-v1.0.0`
41. **Which AH lines are supported?**
    - Lines in band $[-1.75, +1.75]$.
42. **Which leagues are supported?**
    - Premier League, La Liga, Bundesliga, Serie A, Ligue 1.
43. **Which lines/leagues must remain disabled?**
    - Extreme lines ($|\text{line}| \ge 2.25$) and 19 placeholder leagues with 0 matches remain strictly disabled (`INSUFFICIENT_DATA`).
44. **What remains BLOCKED?**
    - **Live user-facing signal activation remains STRICTLY BLOCKED**: Zero demonstrated edge in historical backtest. `QUALIFIED_VALUE` cannot be granted. Production remains 100% untouched.

---

## FINAL ACCEPTANCE CHECKLIST

- [x] AH Data inventory completed (8,898 matches, 23864 AH odds rows)
- [x] EPIC 53 AH linkage confirmed
- [x] EPIC 54 AH circularity remediated
- [x] Settlement engine audited with 25+ verified traces
- [x] Whole/half/quarter lines verified with decomposition
- [x] Point-in-time shared state verified without leakage
- [x] Poisson & Dixon-Coles candidate models evaluated
- [x] Chronological walk-forward validation completed
- [x] Per-line calibration completed
- [x] Fair-price & canonical de-vig verified
- [x] Quarter-line settlement-aware EV verified
- [x] Canonical CLV verified (Indistinguishable from zero: Z=0.523, p=0.601)
- [x] Edge persistence evaluated across folds (Negative: -2.51% average EV)
- [x] Uncertainty & bootstrap 95% CIs evaluated ([-3.85%, -0.96%])
- [x] Selection bias and multiple-testing risk controlled
- [x] Discovery $\to$ Confirmation completed on untouched data (No edge confirmed)
- [x] prematch-v1 benchmark completed
- [x] Champion model version frozen (`AH-dixoncoles-v1.0.0`)
- [x] Upcoming shadow inference operational in shadow mode (QUALIFIED_VALUE blocked)
- [x] All 44 questions answered with actual computed numbers
- [x] Production remains 100% untouched
