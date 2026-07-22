# k-NN FEATURE SIMILARITY ENGINE V2 SPECIFICATION

**Subsystem:** `src/lib/scientific-validation/feature-similarity-engine-v2.ts`

---

## Distance Function

$$\text{Distance}(\mathbf{a}, \mathbf{b}) = \sqrt{\sum_{k} w_k \cdot (a_k - b_k)^2}$$

### Feature Dimension Weights ($w_k$):
- **Expected Goals Differential (xG)**: $2.5$
- **Expected Goals Against Differential (xGA)**: $2.0$
- **Shots Differential**: $1.0$
- **Shots on Target Differential**: $1.5$
- **PPDA (Passes Per Defensive Action)**: $1.0$
- **Rest Days Differential**: $0.8$
- **Travel Distance Differential**: $0.4$
- **ELO Rating Differential**: $1.8$
- **Opening Decimal Odds**: $1.2$
- **Bookmaker Overround**: $0.5$
