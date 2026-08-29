# EPIC 56 — POINT-IN-TIME SHARED FOOTBALL STATE SPECIFICATION

**Execution Timestamp:** 2026-08-29T11:21:09.003Z  
**Status:** `VERIFIED — STRICT ANTI-LEAKAGE ENFORCED`  

---

## 1. Temporal Invariant & Anti-Leakage Guard

For any prediction generated for match $M$ on date $D$:
$$\text{Eligible History} = \{ M_i \mid \text{matchDate}(M_i) < D \}$$
- No future fixture scores or stats enter the calculation.
- No closing market odds enter fundamental feature calculations.

---

## 2. Point-in-Time Features

| Feature Name | Source | Calculation Method | Temporal Cutoff |
|---|---|---|---|
| `homeAttack` | Historical Goals | Exponential time-decay ($t_{1/2} = 90\text{d}$) goals scored vs league average | $< \text{matchDate}$ |
| `homeDefense` | Historical Goals | Exponential time-decay ($t_{1/2} = 90\text{d}$) goals conceded vs league average | $< \text{matchDate}$ |
| `awayAttack` | Historical Goals | Exponential time-decay ($t_{1/2} = 90\text{d}$) goals scored vs league average | $< \text{matchDate}$ |
| `awayDefense` | Historical Goals | Exponential time-decay ($t_{1/2} = 90\text{d}$) goals conceded vs league average | $< \text{matchDate}$ |
| `homeAdvantage` | League History | Empirical home-to-away goal ratio $[1.05, 1.30]$ | $< \text{matchDate}$ |
| `restDays` | Schedule Log | Days since previous match for the team | $< \text{matchDate}$ |
| `expectedHomeGoals` | Poisson Mean $\lambda_h$ | $\text{AvgHome} \times \text{Att}_h \times \text{Def}_a \times \text{Adv}_h \times \text{Rest}_h$ | $< \text{matchDate}$ |
| `expectedAwayGoals` | Poisson Mean $\lambda_a$ | $\text{AvgAway} \times \text{Att}_a \times \text{Def}_h \times \text{Rest}_a$ | $< \text{matchDate}$ |
