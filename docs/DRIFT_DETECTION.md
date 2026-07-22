# DRIFT DETECTION MANUAL

**Subsystem:** `src/live-validation/monitoring/drift-detector.ts`

---

## Population Stability Index (PSI)

$$\text{PSI} = \sum_{k=1}^K \left( \text{Actual}_k - \text{Expected}_k \right) \times \ln\left( \frac{\text{Actual}_k}{\text{Expected}_k} \right)$$

### Decision Matrix:
- **PSI &lt; 0.10**: No significant distribution shift (Stable).
- **0.10 &le; PSI &lt; 0.25**: Moderate drift (Warning alert fired).
- **PSI &ge; 0.25**: Significant structural shift (Critical alert fired).
