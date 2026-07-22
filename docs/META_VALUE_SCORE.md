# META VALUE SCORE SPECIFICATION (0 - 100)

**Subsystem:** `src/lib/quant-market/meta-value-score.ts`

---

## Formulations

$$\text{Meta Score} = \text{EV}_{\text{pts}} + \text{Edge}_{\text{pts}} + \text{Calib}_{\text{pts}} + \text{Sim}_{\text{pts}} + \text{MQ}_{\text{pts}} + \text{League}_{\text{pts}}$$

- **Expected Value (EV)**: Up to 25 pts
- **Probability Edge**: Up to 20 pts
- **Calibration Quality**: Up to 15 pts
- **Historical Similarity Evidence**: Up to 15 pts
- **Market Quality Score**: Up to 12.5 pts
- **League Trust Score**: Up to 12.5 pts
