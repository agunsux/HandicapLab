# DATA QUALITY METRICS SPECIFICATION (0 - 100)

**Subsystem:** `src/lib/data-quality/data-quality-score.ts`

---

## Formulations

$$\text{Data Quality Score} = (0.40 \cdot C_{\%}) + (0.40 \cdot O_{\%}) + (0.20 \cdot (100 - 5 \cdot xG_{\text{missing\%}})) - (25 \cdot D) - (15 \cdot F)$$

Where:
- $C_{\%}$ = Completeness Percentage (populated fields / expected fields)
- $O_{\%}$ = Odds Coverage Percentage (captured quotes / expected bookmakers)
- $xG_{\text{missing\%}}$ = Percentage of missing expected goals data
- $D$ = Duplicate Count (Strict 0 requirement)
- $F$ = Count of Integrity Rule Failures
