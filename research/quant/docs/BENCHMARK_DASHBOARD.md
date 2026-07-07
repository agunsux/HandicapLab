# Benchmark Dashboard

Dashboard ini melacak performa terbaik dari setiap eksperimen (Hanya yang berstatus `ADOPT`).
*Semua metrik dihitung secara Out-Of-Sample melalui arsitektur Walk-Forward Validation.*

| Experiment | Method | LogLoss | Brier | ECE | MCE | Calibration Slope | Status |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **EXP-000** | Bookmaker Baseline (Uncalibrated) | 0.7063 | 0.2560 | 0.0723 | 0.2454 | -0.1845 | `ADOPT` |
| **EXP-001** | Beta Calibration | 0.6908 | 0.2488 | 0.0267 | 0.1452 | -2.2140 | `ADOPT` |
| **EXP-002** | Logistic Regression | *TBD* | *TBD* | *TBD* | *TBD* | *TBD* | `PLANNED` |

*(Dashboard ini harus terus diperbarui setiap kali ada eksperimen baru yang lolos Quality Gate)*
