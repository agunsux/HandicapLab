# Implementation Priority (Quant Research Score)

Matriks **QRS (Quant Research Score)** digunakan untuk memprioritaskan eksperimen yang akan dikodekan ke dalam *Pipeline* Riset. Evaluasi ini menggunakan pendekatan finansial dan skalabilitas, bukan hanya product management.

**Formula QRS:**
```text
QRS = (Expected ROI Gain × Confidence × Generalizability) / (Engineering Effort × Compute Cost × Maintenance Cost)
```

*Skala 1-10 untuk tiap variabel (10 = Tertinggi/Terbaik/Termudah/Termurah).*
- **Expected ROI Gain**: Potensi peningkatan profitabilitas murni (melewati margin *bookmaker*).
- **Confidence**: Dasar teoretis yang kuat atau bukti dari literatur / tes awal.
- **Generalizability**: Seberapa sering model/teknik ini dipanggil (misal: kalibrasi dipanggil *setiap saat*, diskon promosi hanya *sekali setahun*).
- **Engineering Effort**: Waktu dan kompleksitas untuk membuat kodenya. (10 = Sangat Mudah, 1 = Sangat Sulit)
- **Compute Cost**: Biaya *training* & *inference* (CPU/GPU, RAM). (10 = Sangat Murah, 1 = Sangat Mahal)
- **Maintenance Cost**: Biaya operasional, *monitoring* data drift, dan *retraining*. (10 = Sangat Murah, 1 = Sangat Mahal)

---

| Eksperimen | ROI Gain | Conf. | Gen. | Eng. Effort | Comp. Cost | Maint. Cost | QRS Score | Keputusan Sprint 33B |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| **1. Probability Calibration per League** | 8 | 9 | 10 | 8 | 9 | 9 | **466.5** | **Priority #1** |
| **2. Multi-League Global Model + LOLO** | 7 | 8 | 10 | 7 | 6 | 8 | **186.6** | **Priority #2** |
| **3. Promotion/Relegation Diskon** | 7 | 8 | 2 | 8 | 10 | 8 | **71.6** | **Priority #3** |
| **4. Dynamic Home Advantage** | 5 | 7 | 10 | 6 | 8 | 6 | **81.6** | *Backlog* |
| **5. Transfer Learning / Domain Adapt.** | 8 | 5 | 10 | 2 | 4 | 3 | **16.6** | *Backlog* |
| **6. Team Embeddings (Graph)** | 9 | 6 | 10 | 2 | 2 | 2 | **67.5** | *Backlog* |

---

## Urutan Sprint 33B:
1. **Probability Calibration per League**: Metrik terukur, tidak mengubah *feature space*, generalisasi tinggi.
2. **Multi-League Global Model + LOLO (Leave-One-League-Out)**: Keputusan fundamental arsitektur (Satu Model Besar vs N Model Kecil).
3. **Promotion/Relegation Adjustment**: Penting di awal musim, namun karena hanya aktif di 5 laga pertama per tim promosi, prioritasnya diturunkan di bawah eksperimen global.
