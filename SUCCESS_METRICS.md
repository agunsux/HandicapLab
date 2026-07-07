# Success Metrics (The North Star)

Dokumen ini berfungsi sebagai acuan utama (*North Star*) untuk seluruh pengembangan HandicapLab mulai **Sprint 33 hingga Sprint 40 (Phase B: Quant Research)**. 

Keberhasilan proyek tidak lagi diukur dari penyelesaian tiket teknis atau penambahan jumlah *file*, melainkan secara eksklusif dari peningkatan **Expected Betting Edge** dan metrik komersial.

## Baseline & Targets (Sprint 33 - Sprint 40)

| Kategori | Metrik | Baseline Saat Ini (M1) | Target Sprint 40 | Signifikansi Bisnis |
| :--- | :--- | :--- | :--- | :--- |
| **Profitability** | **ROI (Return on Investment)** | ~ -2.5% *(Naïve)* | **+ 5.0%** | Mengalahkan margin *bookmaker* (Vig) secara konsisten. |
| | **Yield** | ~ -2.5% | **+ 5.0%** | Profitabilitas murni per unit risiko yang dipertaruhkan. |
| **Model Accuracy** | **Brier Score** | ~ 0.210 | **< 0.175** | Akurasi probabilitas absolut. Semakin rendah, probabilitas model semakin akurat. |
| | **Log Loss (Cross-Entropy)** | ~ 0.620 | **< 0.560** | Penalti kuat untuk prediksi yang sangat yakin namun salah. |
| | **Calibration Error (ECE)** | ~ 0.045 | **< 0.010** | Jika model bilang 60% menang, historisnya harus benar-benar menang 60 dari 100 kali. |
| **Market Intelligence** | **CLV Hit Rate (Closing Line Value)** | ~ 45.0% | **> 65.0%** | Kemampuan memprediksi pergerakan pasar. Prediksi kita harus lebih tajam dari *Closing Odds* Pinnacle. |
| **Risk Management** | **Sharpe Ratio** | ~ -0.5 | **> 2.0** | Rasio *risk-adjusted return* setara dengan *quant hedge fund* papan atas. |
| | **Maximum Drawdown** | ~ 45.0% | **< 15.0%** | Perlindungan bankroll dari kebangkrutan saat mengalami *variance* / *losing streak*. |
| **Infrastructure** | **Prediction Latency** | ~ 40 ms | **< 15 ms** | Memastikan kesiapan untuk masuk ke *Live In-Play Betting Market*. |
| | **Backtest Runtime (10k match)** | ~ 42.5 s | **< 10.0 s** | Kecepatan iterasi riset dan eksperimen model baru. |

## Prinsip Pengambilan Keputusan Lanjutan
Mulai Sprint 33:
1. **Tidak ada fitur teknis yang disetujui** kecuali pembuat fitur dapat mengajukan hipotesis dampak ROI atau perbaikan Brier Score.
2. Setiap *pull request* untuk mesin ML harus disertai dengan **laporan komparasi metrik** (A/B testing) melawan *baseline* ini.
3. Arsitektur data telah di-*freeze* (Milestone M1). Modifikasi infrastruktur (misal pembaruan DuckDB/Parquet) hanya diizinkan jika terbukti menjadi *bottleneck* langsung terhadap metrik di atas.
