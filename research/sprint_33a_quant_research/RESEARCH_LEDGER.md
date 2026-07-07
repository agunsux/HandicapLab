# Quant Research Ledger

Buku besar ini adalah catatan abadi (*immutable log*) dari setiap eksperimen *machine learning* dan *quantitative research*. Mulai Sprint 33B, seluruh *run* akan dilacak secara otomatis menggunakan **MLflow** dengan mencatat: `git commit`, `feature version`, `dataset version`, `league`, `season`, `market`, `calibration`, `seed`, `train size`, `test size`, `metrics`, dan `artifacts`.

---

## Log Eksperimen

```text
EXP-000
Title: Bookmaker vs Baseline Models
Hypothesis: Current HandicapLab model + Base Stats (Elo, Poisson) baseline against Implied Probability.
Dataset: silver/canonical
Dataset Version: v1.0.0 (Mock Odds Injection for architecture test)
Feature Set: Base (None)
Model: Simple Elo, Poisson, Bookmaker Implied
Calibration: None
Market: Implied Probability / Market Average
Metrics:
  ROI: N/A (Mock)
  Yield: N/A (Mock)
  Brier: Bookie (0.2636), Simple Elo (0.2741), Poisson (0.2567)
  ECE: [Pending calculation]
  Log Loss: Bookie (0.7224), Simple Elo (0.7435), Poisson (0.7075)
Result: Pipeline divalidasi. Poisson dan Bookmaker Implied menjadi anchor point validasi komparasi performa model di atas mock architecture.
Decision: ADOPT baseline pipeline.
Next Action: Lanjut ke EXP-001 untuk murni kalibrasi probabilitas.
```

```text
EXP-001
Title: Pure Probability Calibration (Bookmaker Input)
Hypothesis: Platt, Isotonic, or Beta Calibration will significantly reduce ECE on bookmaker implied probabilities.
Dataset: [Pending]
Dataset Version: [Pending]
...
```
