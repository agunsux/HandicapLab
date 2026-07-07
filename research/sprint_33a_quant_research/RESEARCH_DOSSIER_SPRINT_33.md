# Quant Research Dossier: Sprint 33 (Cross-League Intelligence)

Dokumen ini merinci landasan teoritis, literatur, dan ekspektasi empiris untuk 8 area riset utama dalam memodelkan pertandingan lintas liga (*Cross-League*). Pendekatan ini beralih dari sekadar rekayasa fitur menjadi pemodelan probabilistik tingkat lanjut.

---

## 1. League Strength (Relative Indexing)
- **Pertanyaan Utama:** Bagaimana mengukur kekuatan relatif antar liga tanpa bias?
- **Dasar Teori:** Menggunakan perbandingan antar-liga pada kompetisi kontinental (UEFA Champions League, Europa League). *Network Graph Analysis* atau ekstensi *Bivariate Poisson* pada kompetisi silang.
- **Literatur/Praktik Industri:** Algoritma *ClubElo* menggunakan matriks interkoneksi di mana hasil Liga Champions secara dinamis menyesuaikan *rating* seluruh liga domestik.
- **Expected Impact:** Brier Score (sedang), ROI (kecil, namun krusial untuk kalibrasi global).
- **Kompleksitas:** Menengah (Memerlukan *pipeline* data kompetisi kontinental).
- **Kebutuhan Data:** Hasil pertandingan inter-liga selama 5-10 tahun terakhir.
- **Validasi:** Korelasi *rating* liga dengan performa historis koefisien UEFA.

## 2. Transfer Learning
- **Pertanyaan Utama:** Bagaimana memanfaatkan data EPL untuk liga dengan data lebih sedikit?
- **Dasar Teori:** Membekukan (*freezing*) *hidden layers* awal pada *neural network* yang mempelajari representasi fundamental permainan (misal: korelasi penguasaan bola dan xG) di EPL, lalu melakukan *fine-tuning* pada *layer* akhir menggunakan data liga sekunder.
- **Literatur:** *Pre-training* pada turnamen besar untuk memprediksi liga kecil (*Machine Learning in Sports Analytics*).
- **Expected Impact:** Log Loss (tinggi) pada liga dengan *sample size* kecil.
- **Kompleksitas:** Tinggi (Memerlukan arsitektur *Deep Learning*, bukan sekadar XGBoost standar).

## 3. Multi-task Learning (MTL)
- **Pertanyaan Utama:** Apakah model tunggal lintas liga lebih baik daripada model per liga?
- **Dasar Teori:** MTL berbagi representasi (*shared layers*) untuk mengekstraksi pola umum (seperti efek kelelahan), namun memiliki *league-specific output heads* untuk mengakomodasi karakteristik lokal.
- **Literatur:** Caruana (1997) *Multi-task Learning*. Menghindari *overfitting* dengan memaksakan generalisasi.
- **Expected Impact:** ECE / *Calibration* (tinggi). Model lebih stabil dan *variance* turun.
- **Kompleksitas:** Tinggi.

## 4. Domain Adaptation
- **Pertanyaan Utama:** Bagaimana mengatasi *distribution shift* antar kompetisi (misal: Serie A lebih defensif dari Bundesliga)?
- **Dasar Teori:** *Covariate shift correction*. Menggunakan metode seperti *Maximum Mean Discrepancy (MMD)* atau *Adversarial Domain Adaptation* (DANN) agar representasi ruang *feature* antara dua liga tidak bisa dibedakan oleh *classifier*.
- **Expected Impact:** ROI (tinggi) saat melakukan ekspansi liga baru secara agresif.
- **Kompleksitas:** Sangat Tinggi.

## 5. Team Embeddings
- **Pertanyaan Utama:** Apakah *embedding* tim mengungguli *feature engineering* manual?
- **Dasar Teori:** Merepresentasikan tim sebagai *dense vector* ruang n-dimensi (seperti *Word2Vec*), yang dipelajari dari *match sequence graph* (misal: *Node2Vec* pada graf pertandingan). Model belajar transisi bentuk (*form*) tanpa hitungan manual (rerata gol).
- **Literatur:** *DeepWalk* atau *Graph Neural Networks (GNN)* dalam pemodelan pertandingan.
- **Expected Impact:** Brier Score & Log Loss (sangat tinggi). Transformasi paradigma dari *tabular* ke *relational learning*.
- **Kompleksitas:** Sangat Tinggi. Memerlukan GPU/TensorFlow/PyTorch.
- **Validasi:** Reduksi dimensi t-SNE dari matriks *embedding*—tim elit harus berkumpul dalam satu *cluster*.

## 6. Dynamic Home Advantage
- **Pertanyaan Utama:** Faktor apa saja yang benar-benar meningkatkan akurasi *Home Advantage*?
- **Dasar Teori:** *Hierarchical Bayesian Modeling* di mana *Home Advantage* (HA) memiliki *prior* global, *prior* liga, hingga *prior* tim, ditambah modifikator dinamis (jarak tempuh *away*, *derby*, ketinggian).
- **Literatur:** *Modelling Home Advantage in Association Football* (Pollard). HA telah menyusut secara historis, terutama pasca-VAR dan Covid-19.
- **Expected Impact:** ROI (menengah). Memperbaiki akurasi peluang ganda/imbang.
- **Kompleksitas:** Menengah.
- **Kebutuhan Data:** Koordinat stadion (Haversine formula untuk jarak travel).

## 7. Promotion/Relegation
- **Pertanyaan Utama:** Bagaimana memodelkan transisi antar divisi?
- **Dasar Teori:** *Division Multiplier*. Mengalikan *baseline rating* tim promosi dengan faktor diskon historis (misal: tim juara Championship biasanya bermain setara dengan peringkat ke-15 EPL).
- **Expected Impact:** CLV Hit Rate awal musim (tinggi). *Bookmaker* sering salah menilai tim promosi di pekan 1-5.
- **Kompleksitas:** Menengah.
- **Kebutuhan Data:** *Historical final table standings* divisi ke-2.

## 8. Probability Calibration
- **Pertanyaan Utama:** Apakah perlu kalibrasi per liga atau global?
- **Dasar Teori:** *Platt Scaling* atau *Isotonic Regression* harus diterapkan secara berjenjang (*hierarchical*). Probabilitas 60% di EPL mungkin sebenarnya 58% (karena efisiensi pasar), sementara di liga yang lebih tidak stabil, 60% bisa berarti 65%.
- **Expected Impact:** ECE (sangat tinggi), Max Drawdown (turun drastis). Menghindari taruhan (*overbetting*) saat model *overconfident*.
- **Kompleksitas:** Rendah hingga Menengah.
