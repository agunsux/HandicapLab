# Closing Line Value (CLV) Methodology & Governance

**Document Version:** 1.0.0  
**Status:** APPROVED (Phase 3 Baseline)  
**Location:** `docs/CLV_METHODOLOGY.md`  
**Governing EPIC:** Positive-Yield Handicap Research Engine  

---

## 1. Core Philosophy: CLV as the Ground-Truth Metric

In quantitative sports trading and modern financial markets, realized return on investment (ROI) over short horizons is heavily dominated by variance and sample noise. A coin flipped 100 times can easily produce 60 heads (a 60% hit rate and apparently massive ROI), yet possesses zero edge.

**Closing Line Value (CLV)** is the gold standard for measuring true informational advantage and expected value. The closing price of a liquid, sharp bookmaker reflects the aggregate information of all market participants, syndicates, and quant funds prior to kickoff.

> [!IMPORTANT]
> **Fundamental Market Invariant**:
> If a model systematically beats the closing line ($\text{CLV} > 0$), it demonstrates a repeatable informational advantage over the market. If a model exhibits positive short-term ROI while systematically trailing the closing line ($\text{CLV} < 0$), the strategy is flagged as **spurious / lucky variance** and is structurally barred from production deployment.

---

## 2. Mathematical Formulations

### 2.1 Standard Ratio CLV
For decimal odds taken at a prediction horizon ($t_{\text{pred}} < T_{\text{kickoff}}$) and the closing odds captured inside the closing window $[T_{\text{kickoff}} - 60\text{m}, T_{\text{kickoff}})$:

$$\text{CLV}_{\text{ratio}} = \frac{\text{Odds}_{\text{taken}}}{\text{Odds}_{\text{closing}}} - 1.0$$

- $\text{CLV} > 0$: The price shortened after the bet was taken (market agreed with the model).
- $\text{CLV} = 0$: The price remained unchanged.
- $\text{CLV} < 0$: The price drifted longer (market disagreed with the model).

*Example*:
A bet taken at $2.10$ that closes at $1.95$ yields:
$$\text{CLV} = \frac{2.10}{1.95} - 1.0 = +0.0769 \quad (+7.69\%)$$

### 2.2 Vig-Adjusted (Fair) CLV
Because closing odds include bookmaker overround (vig), raw closing odds slightly underestimate the true market probability. The vig-adjusted CLV compares the taken price against the **de-vigged fair closing probability** $P_{\text{closing, devig}}$:

$$\text{CLV}_{\text{devig}} = \text{Odds}_{\text{taken}} \times P_{\text{closing, devig}} - 1.0$$

Where $P_{\text{closing, devig}}$ is calculated via:
- Multiplicative / Power method for 2-way markets (Asian Handicap, Over/Under, BTTS).
- Shin (1993) method for 3-way markets (1X2 Moneyline).

---

## 3. Bookmaker Ground Truth Hierarchy

CLV is only as credible as the bookmaker from which the closing line is sampled. Comparing against soft, recreational bookmakers (who manage risk by limiting winning accounts rather than adjusting prices) produces fictitious edge.

### Tier 1: Authoritative Ground Truth
- **Pinnacle Sports (`pinnacle`)**: Primary sharp ground truth. Pinnacle operates on low margins ($\approx 1.5\% - 2.5\%$), accepts unlimited sharp volume, and allows prices to find true equilibrium. All production CLV calculations in HandicapLab are anchored to Pinnacle.

### Tier 2: Secondary Sharp Reference
- **SBOBET (`sbobet`)**: Highly liquid Asian bookmaker; used as a secondary reference for Asian Handicap liquidity validation.

### Prohibited for CLV
- **Soft Bookmakers (`bet365`, `williamhill`, `unibet`, etc.)**: Never used as a closing line reference. Beating a recreational bookmaker's sluggish line does not constitute genuine market efficiency edge.

---

## 4. Closing Window Protocol & In-Play Rejection

To guarantee point-in-time correctness:
1. **Closing Observation Window**: Defined deterministically as $[T_{\text{kickoff}} - 60\text{m}, T_{\text{kickoff}})$.
2. **Strict In-Play Exclusion**: Any tick timestamped $t \ge T_{\text{kickoff}}$ is immediately discarded ($100\%$ rejection rate).
3. **No Fabricated Closes**: If no pre-kickoff tick exists within 24 hours of the match, the closing price is logged as `UNAVAILABLE` and excluded from CLV aggregation.

---

## 5. CLV vs ROI Divergence Diagnostics

Every evaluated strategy is subjected to the four-quadrant diagnostic matrix:

```text
                        CLV > 0 (Beating Close)          CLV <= 0 (Trailing Close)
                   +--------------------------------+--------------------------------+
  ROI > 0          |       VALIDATED / PROVISIONAL  |           SPURIOUS             |
  (Profitable)     | Realized profit aligns with    | Positive ROI is lucky variance.|
                   | genuine market line movement.  | Staggering drawdown expected.  |
                   +--------------------------------+--------------------------------+
  ROI <= 0         |       PROVISIONAL EDGE         |            NO EDGE             |
  (Unprofitable)   | Informational edge exists;     | Model has no edge and loses    |
                   | negative ROI is short-term run | money. Discard strategy.       |
                   | bad luck / sample variance.    |                                |
                   +--------------------------------+--------------------------------+
```

### Anomaly Flagging
- If $\text{ROI} > +2.0\%$ but $\text{Mean CLV} < -1.0\%$: The engine triggers an immediate `DIVERGENCE_ALERT`. The strategy is classified as unproven variance.
- If $\text{Mean CLV} > +1.5\%$ but realized ROI is slightly negative due to sample size ($N < 500$): The strategy is classified as **`PROVISIONAL EDGE`**, not `NO EDGE`.

