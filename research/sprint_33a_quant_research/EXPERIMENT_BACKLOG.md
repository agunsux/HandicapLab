# Experiment Backlog (Hypothesis-Driven)

Daftar ini adalah kumpulan *backlog* eksperimen kuantitatif yang akan dimasukkan ke dalam *Pipeline* Riset Python. Metode evaluasi selalu menggunakan **Walk-Forward Validation** dan **Leave-One-League-Out (LOLO)**. Evaluasi hiperparameter selalu dimulai dari Default → Manual → Optuna.

---

### EXP-000: Baseline Benchmark
- **Status:** COMPLETED
- **Hipotesis:** Model HandicapLab harus mengalahkan Implied Probability *bookmaker* & model statistik dasar (Elo, Poisson).

### EXP-001: Pure Probability Calibration
- **Title:** Calibrating Bookmaker Odds
- **Hipotesis:** Probabilitas *bookmaker* tidak terkalibrasi sempurna (terutama karena *margin/vig* dan *favorite-longshot bias*). Mengaplikasikan Platt, Isotonic, atau Beta Calibration pada Bookie Probabilities akan menurunkan ECE secara dramatis.
- **Kandidat Kalibrasi:** Platt Scaling, Isotonic Regression, Beta Calibration.
- **Metrics Utama:** Brier, LogLoss, ECE, MCE, Adaptive ECE, Sharpness.

### EXP-002: Simple Logistic Regression
- **Title:** Linear Baseline
- **Hipotesis:** Model linear dasar (Logistic Regression) menggunakan fitur *rolling averages* dasar akan memberikan performa yang solid dan *explainable*.
- **Baseline:** EXP-001 Calibrated Probabilities.

### EXP-003: Poisson + Elo Hybrid
- **Title:** Statistical Model Hybridization
- **Hipotesis:** Menggabungkan *rating* Elo dengan estimasi Poisson untuk xG akan mengalahkan regresi logistik murni dengan *feature engineering* yang lebih efisien.

### EXP-004: LightGBM
- **Title:** Gradient Boosting Base
- **Hipotesis:** *Tree-based model* (LightGBM) akan mendeteksi interaksi non-linear yang terlewat oleh Logistic Regression, memimpin perbaikan Log Loss yang signifikan.

### EXP-005: XGBoost
- **Title:** Extreme Gradient Boosting
- **Hipotesis:** XGBoost mungkin memberikan ketahanan *overfitting* yang lebih baik dari LightGBM pada dataset kecil.

### EXP-006: CatBoost
- **Title:** Categorical Boosting
- **Hipotesis:** Penanganan *categorical features* (seperti nama tim, nama liga, bulan) secara *native* oleh CatBoost akan mengungguli XGBoost & LightGBM tanpa *One-Hot Encoding*.

### EXP-007: Ensemble & Stacking
- **Title:** Multi-Model Ensemble
- **Hipotesis:** Menumpuk (*stacking*) probabilitas dari CatBoost, LightGBM, dan Logistic Regression via meta-learner akan meningkatkan stabilitas *Log Loss* dan kalibrasi lintas liga.
