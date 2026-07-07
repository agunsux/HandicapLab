# Model Governance: Champion vs Challenger

Untuk mencegah regresi performa dan over-complication pada Quant Research Platform HandicapLab, setiap model Machine Learning baru harus tunduk pada hierarki **Champion vs Challenger**.

## Syarat Promosi ke Status CHAMPION

Sebuah *Challenger Model* hanya boleh dipromosikan menggantikan *Champion Model* apabila memenuhi **seluruh** kriteria berikut:

1. **Lolos Quality Gate Penuh**: Tidak ada kebocoran data (*leakage*), metrik tervalidasi, dan metadata tercatat dengan sukses.
2. **Kemenangan Signifikan**: Secara statistik mengalahkan *Champion* yang ada (misal melalui *Paired Permutation Test* dengan `p_value < 0.05` pada metrik utama seperti *Brier Score* atau *LogLoss*).
3. **Stabilitas Temporal**: Menunjukkan performa yang lebih baik (atau setidaknya tidak lebih buruk) pada **minimal dua musim berturut-turut** dalam pengujian *Walk-Forward Validation*.
4. **Generalisasi Liga (LOLO)**: Mampu mempertahankan keunggulan *edge*-nya saat diuji dengan metode *Leave-One-League-Out*. Hal ini menjamin bahwa model menangkap prinsip fundamental sepak bola, bukan melakukan *overfitting* pada karakteristik satu liga spesifik.
5. **Cost vs Benefit (QRS)**: Memiliki *Quant Research Score* (QRS) yang positif. Peningkatan performa (ROI/Edge) harus sepadan dengan beban *engineering* dan komputasi (*maintenance cost*).

Jika salah satu dari syarat ini gagal, model tersebut tetap berstatus **CHALLENGER** atau diarsipkan sebagai **REVISIT**.
