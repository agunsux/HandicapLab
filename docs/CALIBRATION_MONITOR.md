# CALIBRATION MONITORING MANUAL

**Subsystem:** `src/live-validation/monitoring/calibration-monitor.ts`

---

## Technical Overview

Calibration measures whether predicted probabilities correspond to empirical long-run event frequencies.

### Expected Calibration Error (ECE)
$$\text{ECE} = \sum_{b=1}^B \frac{|B_b|}{N} \left| \text{acc}(B_b) - \text{conf}(B_b) \right|$$

### Maximum Calibration Error (MCE)
$$\text{MCE} = \max_{b=1}^B \left| \text{acc}(B_b) - \text{conf}(B_b) \right|$$

### Thresholds:
- **Optimal**: ECE &lt; 2.5%
- **Acceptable**: ECE &lt; 4.0%
- **Alert Trigger**: ECE &gt; 5.0%
