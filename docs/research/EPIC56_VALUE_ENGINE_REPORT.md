# EPIC 56 — VALUE & EV ENGINE REPORT

**Execution Timestamp:** 2026-08-29T11:21:09.004Z  

---

## 1. Settlement-Aware Quarter-Line EV Formula

$$\text{EV} = P(\text{FW}) \cdot (O - 1) + P(\text{HW}) \cdot \frac{O - 1}{2} + P(\text{Push}) \cdot 0 + P(\text{HL}) \cdot (-0.5) + P(\text{FL}) \cdot (-1.0)$$

---

## 2. Value Qualification Hierarchy

1. `INSUFFICIENT_DATA`: $|\text{line}| \ge 2.25$ or sample size $< 250$.
2. `NO_EDGE`: $\text{EV} \le 0$ or $\text{Edge} \le 0$.
3. `LOW_CONFIDENCE_EDGE`: $0 < \text{EV} < 2.0\%$ or limited sample size.
4. `QUALIFIED_VALUE`: $\text{EV} \ge 2.0\%$, adequate sample, and historical confirmation PASS with statistically significant positive CLV.
5. `NOT_VALIDATED`: Default state if historical hypothesis fails out-of-sample confirmation or CLV is indistinguishable from noise.
