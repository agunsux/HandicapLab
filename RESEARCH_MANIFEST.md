# Research Manifest — HandicapLab Sprint 1

## 1. Hipotesis
Model prediksi HandicapLab menghasilkan edge positif yang signifikan secara statistik terhadap Pinnacle closing odds pada liga top Eropa.

## 2. Dataset

| Aspek | Spesifikasi |
|-------|-------------|
| Sumber | Football-Data.co.uk (Pinnacle odds) |
| Liga | EPL, Bundesliga, Serie A, La Liga, Ligue 1 |
| Rentang | 2020-2021 s.d. 2024-2025 (5 musim) |
| Snapshot | SHA-256 dari file CSV sebelum preprocessing — hash dictatakan |
| Filter | Hanya pertandingan dengan Pinnacle closing odds lengkap (PSCH, PSCD, PSCA) |
| Exclude | Playoff, relegation playoff, pre-season friendly |

## 3. Aturan De-Vig
Untuk setiap pertandingan, implied probability dihitung sebagai:
```
totalImplied = 1/oddsHome + 1/oddsDraw + 1/oddsAway
vig = totalImplied - 1
fairProbHome = (1/oddsHome) / totalImplied
fairProbDraw = (1/oddsDraw) / totalImplied
fairProbAway = (1/oddsAway) / totalImplied
```
De-vig WAJIB — tidak ada odds mentah yang digunakan sebagai probabilitas.

## 4. Strategi Betting
| Parameter | Nilai |
|-----------|-------|
| Model | Flat stake per bet |
| Stake | 1 unit per bet |
| EV threshold minimum | EV ≥ 5% (`modelProb * odds - 1 ≥ 0.05`) |
| Market | Moneyline (1X2) hanya — tidak ada AH/OU untuk Sprint 1 |
| Sisi | Hanya home win dan away win (tidak ada draw bet) |

## 5. Protokol Validasi
Walk-forward validation dengan chronologically ordered data:
```
Window size: 20% dari dataset
Step size: 10% dari dataset
Train: 70% pertama dari setiap window
Test: 30% terakhir dari setiap window
```
Setiap window: train calibration → test prediction. Tidak ada leakage.

## 6. Baseline Models (10)
1. Closing Odds — vig-adjusted market probability pada sisi favorit
2. Opening Odds — vig-adjusted opening price
3. Home Favorite — selalu bet home jika favorit
4. Away Favorite — selalu bet away jika favorit
5. Always Home — bias home
6. Always Away — bias away
7. Always Draw — bias draw
8. Random — weighted random
9. Market Implied — home probability dari closing odds
10. Flat 50% — 50% pada favorit

## 7. Metrik

### Primer (penentu keputusan)
| Metrik | Target | Threshold |
|--------|--------|-----------|
| ROI | > market baselines | ROI ≥ 2% di aggregate |
| CLV | Positive | CLV > 0 signifikan (p < 0.05) |
| Calibration ECE | < 5% | ECE < 0.05 |

### Sekunder (pelengkap)
| Metrik | Target |
|--------|--------|
| Brier Score | < market baseline |
| Log Loss | < market baseline |
| Accuracy | > 50% |
| Yield | > 0% |

## 8. Signifikansi Statistik
| Metode | Threshold |
|--------|-----------|
| Bootstrap CI 95% | Lower bound ROI > 0 |
| Wilson Interval | Lower bound accuracy > 0.5 |
| Binomial Test | p < 0.05 (two-tailed) |
| FDR (BH) | q < 0.10 untuk multiple comparison lintas musim |

## 9. Kriteria Keberhasilan (ditetapkan SEBELUM eksekusi)

**PRIMARY ENDPOINT:** Model ROI > Closing Odds ROI di minimal 4 dari 5 musim, dengan 95% CI lower bound > 0 di aggregate.

Model dinyatakan **MEMILIKI EDGE** jika:
- ✅ Aggregate ROI > Closing Odds ROI
- ✅ Aggregate CLV > 0 (p < 0.05)
- ✅ Aggregate ECE < 0.05
- ✅ Bootstrap 95% CI lower bound > 0 untuk ROI aggregate
- ✅ Edge konsisten di minimal 4 dari 5 musim

Model dinyatakan **TIDAK MEMILIKI EDGE** jika:
- ❌ Aggregate ROI <= Closing Odds ROI
- ATAU ❌ CLV <= 0
- ATAU ❌ ECE >= 0.10
- ATAU ❌ Edge hanya muncul di ≤ 2 musim

## 10. Immutable Record
Setiap eksekusi eksperimen menghasilkan:
- File JSON berisi seluruh parameter yang digunakan
- Dataset hash yang digunakan
- Seed untuk reproducibility
- Seluruh metrik per model per musim
- Confidence intervals per metrik
- Timestamp eksekusi

Tidak ada hasil yang diubah setelah dilihat.
Tidak ada metrik yang dipilih setelah data dianalisis.
Tidak ada threshold yang disesuaikan berdasarkan hasil.

---

*Manifest ini dikunci sebelum eksperimen dijalankan. Pelanggaran terhadap protokol di atas membatalkan validitas hasil.*
