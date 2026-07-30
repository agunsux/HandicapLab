# Master Audit Requirements & Prompt Template

This document contains the canonical prompt and requirements for running a Production Scientific Audit on HandicapLab.
Any AI agent or engineer tasked with auditing the model MUST use this prompt as the baseline.

## Audit Prompt

```text
Lakukan PRODUCTION SCIENTIFIC AUDIT terhadap HandicapLab.

Jangan mengubah satu baris kode pun.

Tujuan audit adalah membuktikan bahwa model benar-benar bekerja secara ilmiah dan bukan sekadar menghasilkan probabilitas.

Verifikasi seluruh pipeline berikut.

======================================================
I. DATA QUALITY AUDIT
======================================================

Buktikan kualitas seluruh input model.

Untuk setiap provider tampilkan:
- Coverage
- Missing %
- Latency
- Duplicate %
- Outlier %
- Timezone consistency
- Cancelled matches
- Postponed matches
- Odds movement completeness
- Historical depth
- Bookmaker coverage

Pastikan tidak ada:
- future leakage
- duplicate fixtures
- wrong kickoff
- stale odds
- mixed season
- incorrect team mapping

======================================================
A. DATA INGESTION
======================================================

Buktikan:
- fixture berhasil diambil
- odds berhasil diambil
- historical matches berhasil diambil
- standings berhasil diambil
- H2H berhasil diambil
- injuries (jika ada)
- lineups (jika ada)

Tampilkan contoh data nyata.

======================================================
B. FEATURE ENGINEERING
======================================================

Untuk minimal 3 pertandingan hari ini tampilkan seluruh feature yang dipakai model.

Misalnya:
- home_attack_strength
- away_attack_strength
- recent_form
- rolling_xg
- elo
- home_advantage
- goals_for
- goals_against
- poisson_lambda_home
- poisson_lambda_away

Jika feature tidak tersedia jelaskan alasannya.

======================================================
C. MODEL EXECUTION
======================================================

Tunjukkan seluruh output intermediate.

Misalnya:
- Expected Goals
- λ home
- λ away
- Probability Matrix
- Poisson Score Matrix
- Dixon Coles Adjustment
- Home Win
- Draw
- Away Win
- Calibration
- Confidence

======================================================
D. MARKET ENGINE
======================================================

Untuk setiap market tampilkan:
- Bookmaker Odds
- Implied Probability
- Model Probability
- Edge
- Expected Value
- Kelly Fraction
- Recommended Pick

======================================================
E. HISTORICAL VALIDATION
======================================================

Ambil minimal 100 pertandingan terakhir yang sudah selesai.

Jangan hanya hitung ROI. Hitung juga Closing Line Value (CLV) menggunakan Pinnacle sebagai ground truth.

Untuk setiap prediction tampilkan:
- Opening Odds
- Prediction Time
- Captured Odds
- Closing Odds
- Closing Line Value

Hitung agregasi:
- ROI
- Yield
- Hit Rate
- Average CLV
- Median CLV
- Brier Score
- Log Loss
- Calibration Error
- Profit by League
- Profit by Market
- Profit by Confidence Grade
- CLV by League
- CLV by Confidence
- CLV by Market

Jika CLV positif namun ROI masih negatif, jelaskan apakah jumlah sampel belum cukup atau ada indikasi masalah pada model.

======================================================
F. LIVE DATABASE VERIFICATION
======================================================

Pastikan setiap prediction benar-benar berasal dari model.

Tunjukkan:
- match_id
- prediction_id
- created_at
- model_version
- feature_version
- prediction_time

======================================================
G. TRACEABILITY
======================================================

Untuk satu pertandingan pilih secara acak.

Rekonstruksi seluruh pipeline mulai dari:

Raw Fixture
↓
Historical Data
↓
Feature Engineering
↓
Model
↓
Probability
↓
Expected Value
↓
Recommendation

hingga row terakhir di database.

======================================================
H. FINAL VERDICT
======================================================

Berikan penilaian:

Pipeline Running: YES / NO
Scientific Model Running: YES / NO
Historical Features Used: YES / NO
Prediction Traceable: YES / NO
Model Scientifically Auditable: YES / NO
Expected Value Correct: YES / NO
ROI Proven: YES / NO

Jika ada bagian yang belum bisa dibuktikan, jangan berasumsi. Jelaskan bukti apa yang kurang.
```
