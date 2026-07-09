# Provider Recommendation — Shadow Pipeline Data Sources

## Recommendation: D — Hybrid Architecture with Provider Specialization

**API-Football untuk non-odds data (fixtures, results, standings, lineups, injuries, statistics).**
**The Odds API untuk odds data (Moneyline, Over/Under, Asian Handicap).**

Keputusan ini didasarkan pada prinsip bahwa **setiap edge HandicapLab dihitung terhadap bookmaker**, sehingga kualitas odds jauh lebih penting daripada kuantitas pertandingan.

---

## Rationale

### Kenapa tidak fallback (Primary + Backup)?

Karena API-Football dan The Odds API memiliki kelebihan yang **saling melengkapi, bukan saling menggantikan**:

| Domain | API-Football | The Odds API |
|--------|:-----------:|:------------:|
| Fixtures | ✅ 100+ leagues | ✅ ~30 leagues |
| Results | ✅ | ✅ |
| Standings | ✅ | ❌ |
| Lineups | ✅ | ❌ |
| Injuries | ✅ | ❌ |
| Statistics | ✅ (xG, shots, dll) | ❌ |
| Moneyline (h2h) | ⚠️ tidak konsisten per liga | ✅ konsisten |
| Over/Under (totals) | ⚠️ tidak konsisten per liga | ✅ konsisten |
| Asian Handicap (spreads) | ⚠️ tidak konsisten per liga | ✅ konsisten |

**Problem API-Football untuk odds**: Coverage odds tidak seragam. Liga A punya AH, liga B tidak. Dataset jadi bolong — berbahaya untuk research EV.

**Solusi**: Pisahkan tanggung jawab. API-Football urus data pertandingan. The Odds API urus odds.

---

## Recommended Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                       PROVIDER LAYER                              │
│                                                                    │
│  ┌──────────────────────────┐   ┌──────────────────────────────┐  │
│  │   API-Football Client     │   │    The Odds API Client      │  │
│  │                          │   │                              │  │
│  │  → FixturesProvider       │   │  → OddsProvider              │  │
│  │  → ResultsProvider        │   │    • Moneyline (h2h)         │  │
│  │  → StandingsProvider      │   │    • Over/Under (totals)     │  │
│  │  → LineupsProvider        │   │    • Asian Handicap (spreads)│  │
│  │  → StatisticsProvider     │   │                              │  │
│  └──────────┬───────────────┘   └──────────┬───────────────────┘  │
│             │                               │                      │
└─────────────┼───────────────────────────────┼──────────────────────┘
              │                               │
              ▼                               ▼
     ┌──────────────────┐          ┌──────────────────────┐
     │  Fixture Store    │          │  Odds Snapshot Store  │
     │  (raw JSON)       │          │  (raw + normalized)   │
     └──────────────────┘          └──────────────────────┘
              │                               │
              └──────────────┬────────────────┘
                             ▼
                    ┌──────────────────┐
                    │  Shadow Pipeline  │
                    │  (immutable)      │
                    └──────────────────┘
```

**Prinsip arsitektur:**
- Setiap provider mengimplementasikan interface spesifik (`IFixturesProvider`, `IOddsProvider`)
- Keduanya independen — tidak ada hierarchy primary/fallback
- Semua raw payload disimpan untuk auditability
- Normalisasi terjadi di layer snapshot, bukan di provider

---

## Kenapa The Odds API untuk Odds?

### 1. Konsistensi Market

The Odds API memiliki endpoint terpisah untuk setiap market:
- `markets=h2h` → Moneyline (selalu ada untuk semua pertandingan)
- `markets=spreads` → Handicap (selalu ada untuk semua pertandingan)
- `markets=totals` → Over/Under (selalu ada untuk semua pertandingan)

Dengan satu request, Anda mendapat ketiga market secara konsisten untuk semua pertandingan dalam satu sport key. Tidak ada bolong antar liga.

### 2. Vig Removal yang Akurat

Karena The Odds API mengembalikan odds dari multiple bookmakers, Anda bisa:
- Bandingkan odds antar bookmaker
- Hitung fair odds dengan vig removal
- Deteksi market move
- Hitung CLV akurat

### 3. Historical Odds

The Odds API menyediakan historical odds snapshots (pada paid plan). Ini penting untuk backtesting setelah data terkumpul.

### 4. Harga

| Plan | Biaya | Request | Kecukupan |
|------|:-----:|:-------:|:---------:|
| Free | $0 | 500/bulan | ✅ Sprint 4A–4B (cukup untuk testing) |
| Starter | $30/bulan | 20.000/bulan | ✅ Sprint 4C–4D |

---

## Kenapa API-Football untuk Non-Odds?

### 1. Coverage Pertandingan



---

## Sprint 4 — Revised Roadmap

### Sprint 4A — Live Data Infrastructure (Estimasi: 20–30 jam)

**Tujuan**: Membangun infrastruktur provider production-grade tanpa menyentuh model.

### Fondasi Arsitektur — 7 Prinsip Sprint 4A

#### 1. Repository Pattern — Provider Tidak Menyentuh Database

```
API-Football
        │
        ▼
ApiFootballProvider
        │
        ▼
Normalized Match Object    ← Provider hanya fetch + normalize
        │
        ▼
Repository Layer           ← Repository yang menyimpan ke DB
        │
        ▼
fixtures | matches | teams | players
```

```
The Odds API
        │
        ▼
OddsProvider
        │
        ▼
Normalized Odds Object     ← Provider hanya fetch + normalize
        │
        ▼
OddsSnapshotRepository     ← Repository yang menyimpan ke DB
        │
        ▼
odds_snapshots
```

Provider bertanggung jawab pada **satu hal**: mengambil data dari API eksternal dan menormalkannya ke tipe internal. Penyimpanan ke database dilakukan oleh **Repository Layer**. Ini menjaga setiap layer tetap testable dan mudah diganti.

#### 2. Simpan Raw Payload

Setiap respons API mentah harus disimpan sebagai bukti audit.

```sql
CREATE TABLE provider_payloads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider      VARCHAR(50) NOT NULL,
  endpoint      VARCHAR(255) NOT NULL,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fixture_id    VARCHAR(50),
  payload_json  JSONB NOT NULL,
  status        INTEGER NOT NULL,
  checksum      VARCHAR(64),
  duration_ms   INTEGER
);
```

**Kegunaan**: debugging, replay, audit, recovery, versioning struktur API.

#### 3. Snapshot Odds Bersifat Immutable (Append-Only)

Odds adalah **time-series data**. Jangan pernah meng-update baris yang sudah ada.

```
Fixture AH Movement:
09:00   AH -0.25  1.88
09:30   AH -0.25  1.91    ← baris baru, bukan update
10:15   AH -0.5   2.01    ← baris baru
11:00   AH -0.5   1.95    ← baris baru
```

Dengan append-only Anda dapat menghitung:
- **CLV** — odds terakhir sebelum kick-off vs fair odds
- **Line movement** — arah pergerakan pasar
- **Steam moves** — pergerakan tiba-tiba (sharp money)
- **Volatility** — fluktuasi odds menjelang pertandingan
- **Opening odds** — odds pertama yang tercatat

**Jangan pernah** `UPDATE` atau `UPSERT` odds snapshot. Hanya `INSERT`.

#### 4. Scheduler Berbasis State Machine

Gunakan state machine per fixture, bukan cron job yang memanggil endpoint tanpa konteks.

```
SCHEDULED  ──► polling odds (10 menit)
    │
    ▼
LIVE       ──► polling odds (2–5 menit)
    │
    ▼
FINISHED   ──► ambil hasil + statistik
    │
    ▼
SETTLED    ──► hitung outcome + validasi
    │
    ▼
ARCHIVED   ──► evidence chain final
```

| State | Job | Frekuensi |
|-------|-----|:---------:|
| `SCHEDULED` | Sinkronisasi odds, pre-match data | 10 menit |
| `LIVE` | Polling odds cepat, update skor | 2–5 menit |
| `FINISHED` | Ambil hasil, xG, statistik | 1× (event-driven) |
| `SETTLED` | Hitung outcome, CLV, EV | 1× |
| `ARCHIVED` | Finalisasi evidence chain, SHA-256 | 1× |

Setiap fixture hanya diproses sesuai siklus hidupnya — tidak ada polling percuma.

#### 5. Simpan Provider Metadata di Setiap Snapshot

```sql
CREATE TABLE odds_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id      VARCHAR(50) NOT NULL,
  market          VARCHAR(20) NOT NULL,
  selection       VARCHAR(50) NOT NULL,
  handicap        DECIMAL(4,2),
  price           DECIMAL(6,3) NOT NULL,
  provider        VARCHAR(50) NOT NULL,
  provider_version VARCHAR(20),
  sport_key       VARCHAR(50),
  bookmaker       VARCHAR(50),
  last_update     TIMESTAMPTZ,
  captured_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw_payload_id  UUID REFERENCES provider_payloads(id)
);
```

Dengan metadata: lacak perubahan struktur API, bandingkan kualitas provider, filter bookmaker tertentu (Pinnacle sebagai sharp reference), ukur kelambatan data.

#### 6. Provider Registry — Jangan Terkunci pada Dua Provider

```typescript
interface ProviderRegistry {
  register(name: string, provider: Provider): void;
  resolve(name: string): Provider;
  getAll(): Map<string, Provider>;
}
```

Registrasi + dependency injection sederhana:

```typescript
registry.register('api-football', new ApiFootballProvider(config.apiFootball));
registry.register('the-odds-api', new OddsApiProvider(config.oddsApi));

const fixtureProvider = registry.resolve('api-football');
const oddsProvider = registry.resolve('the-odds-api');
```

Provider baru cukup registrasi — tidak ada kode bisnis yang berubah:

```typescript
class PinnacleProvider implements IOddsProvider { ... }
registry.register('pinnacle', new PinnacleProvider(config.pinnacle));
```

Penambahan provider (Pinnacle, Bet365, Betfair, SportMonks) tidak memerlukan perubahan di layer bisnis, pipeline, atau repository.

#### 7. The Odds API sebagai Single Source of Truth untuk Odds

Seluruh metrik harus menggunakan **satu sumber odds yang konsisten**:

| Metrik | Odds Source | Alasan |
|--------|:-----------:|--------|
| EV (Expected Value) | The Odds API | Konsistensi market per fixture |
| CLV (Closing Line Value) | The Odds API | Append-only → closing line akurat |
| ROI / PnL | The Odds API | Semua bet terhadap odds yang sama |
| Calibration (ECE) | The Odds API | Reliabilitas prob vs market implied |
| Brier Score | The Odds API | Akurasi prediksi terhadap buku |
| Paper Trading | The Odds API | Level playing field antar fixture |

**Aturan**: Provider odds lain boleh digunakan untuk:
- ✅ Cross-check (bandingkan odds Pinnacle vs market)
- ✅ Deteksi anomali (perbedaan odds signifikan antar bookmaker)
- ❌ Bukan sebagai sumber metrik resmi (hanya The Odds API)

Dengan satu reference odds, interpretasi hasil penelitian tidak tercampur oleh perbedaan coverage atau kualitas antar provider odds.

**Komponen:**

| Komponen | Detail | Prioritas |
|----------|--------|:---------:|
| Provider abstraction | Base classes, interfaces, factory | P0 |
| Rate limiter | Per-provider token bucket | P0 |
| Retry + backoff | Reuse `lib/retry.ts`, per-provider config | P0 |
| Cache layer | In-memory TTL cache untuk deduplikasi | P1 |
| Circuit breaker | Fail after N consecutive errors | P1 |
| Provider priority | Weighted round-robin atau manual override | P2 |
| Failover | Graceful degradation jika satu provider down | P1 |
| Logging | Structured logger per provider call | P0 |
| Health check | Endpoint terintegrasi untuk monitoring | P1 |
| Request deduplication | IDEMPOTENT — jangan fetch fixture yang sama dua kali | P0 |
| Scheduler | Cron-based periodic ingestion | P1 |
| Snapshot storage | Raw JSON + normalized odds | P0 |
| Error classification | Timeout vs rate-limit vs data-error vs auth | P1 |

**Output directory structure:**

```
src/lib/data/providers/
  apiFootball/
    client.ts              ← HTTP client, auth, rate limit
    fixturesProvider.ts    ← IFixturesProvider
    resultsProvider.ts     ← IResultsProvider
    standingsProvider.ts
    statisticsProvider.ts
    lineupsProvider.ts
  
  theOddsApi/
    client.ts              ← HTTP client, auth, rate limit
    oddsProvider.ts         ← IOddsProvider (ML, OU, AH)
    historicalOddsProvider.ts (paid tier)
  
  core/
    providerFactory.ts      ← Instantiation + config
    rateLimiter.ts           ← Token bucket


---

### Sprint 4C — Research dengan Data Nyata

**Tujuan**: Validasi model terhadap data pasar sesungguhnya.

**Pipeline penelitian:**
1. Poisson → prediksi gol
2. Dixon-Coles → korelasi gol rendah
3. Fair odds → vig removal
4. Edge → model prob - market implied prob
5. CLV → closing line value
6. Calibration → ECE, reliability diagram
7. Brier score → accuracy
8. Kelly criterion → staking
9. Expected value → EV per pick

**Hanya promosikan model yang memiliki edge terhadap closing odds.**

---

### Sprint 4D — Production Recommendation

**Tujuan**: Jika model terbukti memiliki edge, rekomendasikan produk.

**Output potensial:**


---

## Risks — Revised

| Risk | Likelihood | Dampak | Mitigasi |
|------|:----------:|:------:|----------|
| The Odds API spreads ≠ Asian Handicap sejati | High | Tinggi | Verifikasi sampel manual; jika perlu, tambahkan SportMonks |
| API-Football free tier (100 req/day) tidak cukup | High | Tinggi | Upgrade ke Basic ($25/bln) segera |
| The Odds API free tier (500 req/bln) tidak cukup | Medium | Sedang | Upgrade ke Starter ($30/bln) di Sprint 4B |
| Provider API downtime | Low | Tinggi | Circuit breaker + retry + logging |
| Rate limit tanpa peringatan | Medium | Sedang | Header monitoring + alerting |
| Perubahan API provider | Low | Tinggi | Simpan raw JSON sebagai fallback data |
| Biaya membengkak | Low | Rendah | Kedua provider murah sampai skala besar |

---

## Action Items — Revised

### Immediate (hari ini)

1. **Register API-Football** via RapidAPI — free tier
2. **Register The Odds API** — free tier (500 req/month)
3. **Buat `.env.local`** dengan kedua API key
4. **Konversi dokumen ini** menjadi task board

### Sprint 4A (minggu 1–2)

5. Implementasi `core/rateLimiter.ts`
6. Implementasi `core/circuitBreaker.ts`
7. Implementasi `apiFootball/client.ts`
8. Implementasi `apiFootball/fixturesProvider.ts`
9. Implementasi `apiFootball/resultsProvider.ts`
10. Implementasi `apiFootball/standingsProvider.ts`
11. Implementasi `theOddsApi/client.ts`
12. Implementasi `theOddsApi/oddsProvider.ts`
13. Integrasi dengan Shadow Pipeline
14. Migration `008_provider_logs.sql`
15. Migration `009_raw_payloads.sql`
16. Health check endpoint `/api/admin/provider-health`

### Sprint 4B (minggu 3–6)

17. Jalankan scheduler — fetch fixtures + odds tiap jam
18. Monitor pipeline health
19. Verifikasi evidence chain (SHA-256)
20. Tunggu 100 settled matches

### Sprint 4C (minggu 7–8)

21. Poisson + Dixon-Coles dengan data nyata
22. Hitung CLV terhadap closing odds
23. Hitung calibration (ECE < 5%?)
24. Bootstrap CI (edge > 0?)

### Sprint 4D (minggu 9–10)

25. Signal feed jika edge positif
26. Public ledger untuk transparansi
27. Rekomendasi go/no-go untuk produksi

---

## Urutan Prioritas (Technical Lead Perspective)

1. 🔴 **Implementasi provider layer** — API-Football + The Odds API
2. 🔴 **Pastikan ingestion idempotent** — jangan fetch fixture dua kali
3. 🟡 **Simpan semua raw payload** — auditability + fallback
4. 🟡 **Jalankan pengumpulan data** — tanpa mengubah model
5. 🟢 **Validasi pipeline** setelah dataset memenuhi ukuran minimum
6. 🟢 **Promosikan model** hanya jika terbukti memiliki edge terhadap closing odds

---

## Summary

| Pertanyaan | Jawaban |
|------------|---------|
| Apakah provider saat ini cukup? | ❌ Tidak — belum ada implementasi sama sekali |
| Rekomendasi arsitektur? | **D — Hybrid** (API-Football non-odds, The Odds API odds) |
| Kenapa dua provider? | Keduanya saling melengkapi, bukan hierarki primary/fallback |
| Kenapa The Odds API untuk odds? | Konsistensi market, vig removal multi-bookmaker, historical data |
| Kenapa API-Football untuk non-odds? | 100+ leagues, lineups, injuries, xG, standings |
| Estimasi implementasi Sprint 4A? | **20–30 jam** (production-grade) |
| Estimasi biaya per bulan? | ~$0 (free tier testing), ~$55/bulan (Basic + Starter produksi) |
| Bisakah Sprint 4 dimulai sekarang? | ❌ — provider infrastructure harus dibangun terlebih dahulu |
| Total durasi Sprint 4A–4D? | **~10 minggu** |

---

## Implementation Cost — Revised

| Komponen | Effort | Catatan |
|----------|:------:|---------|
| API-Football client + auth + rate limit | 2–3 jam | Foundation |
| Fixtures provider | 2–3 jam | Dengan pagination + deduplikasi |
| Results provider | 1–2 jam | |
| Standings provider | 1 jam | |
| Statistics provider | 2–3 jam | xG, shots, dll |
| Lineups provider | 1 jam | |
| The Odds API client + auth | 1 jam | Lebih sederhana dari API-Football |
| Odds provider (ML, OU, AH) | 2–3 jam | Dengan normalization |
| Historical odds provider | 1–2 jam | Paid tier |
| Rate limiter (token bucket) | 2 jam | Per-provider config |
| Circuit breaker | 1–2 jam | |
| Cache + deduplikasi | 1–2 jam | |
| Scheduler | 2 jam | Cron-based, idempotent |
| Snapshot storage + raw JSON | 2–3 jam | DB + file storage |
| Error classification | 1 jam | |
| Health check endpoint | 1 jam | |
| Integration tests | 3–4 jam | Mock + live |
| Configuration + .env | 30 menit | |
| **Total** | **~28 jam** | production-grade |

---

### Sprint 4B — Data Accumulation (2–4 minggu)

| Target | Minimum | Stretch |
|--------|:-------:|:-------:|
| AH samples | 150 | 250 |
| OU samples | 100 | 200 |
| ML samples | 50 | 100 |
| Total odds snapshots | 500 | 1000 |
| Settled matches | 100 | 200 |
| Leagues covered | 10 | 20 |

**Aktivitas:**
- Monitoring pipeline health setiap hari
- Logging provider errors
- Verifikasi integritas rantai evidence ledger
- **Tidak ada perubahan model**

---

### Sprint 4C — Research dengan Data Nyata (minggu 7–8)

**Tujuan**: Validasi model terhadap data pasar sesungguhnya.

**Pipeline penelitian:**
1. Poisson → prediksi gol
2. Dixon-Coles → korelasi gol rendah
3. Fair odds → vig removal
4. Edge → model prob - market implied prob
5. CLV → closing line value
6. Calibration → ECE, reliability diagram
7. Brier score → accuracy
8. Kelly criterion → staking
9. Expected value → EV per pick

**Hanya promosikan model yang memiliki edge terhadap closing odds.**

---

### Sprint 4D — Production Recommendation (minggu 9–10)

**Tujuan**: Jika model terbukti memiliki edge, rekomendasikan produk.

**Output potensial:**
- Signal Feed (daily picks)
- Premium Picks (subscription)
- AI Advisor (dashboard insight)
- Public Ledger (transparansi kinerja)

---

## Risks — Revised

| Risk | Likelihood | Dampak | Mitigasi |
|------|:----------:|:------:|----------|
| The Odds API spreads ≠ Asian Handicap sejati | High | Tinggi | Verifikasi sampel manual; jika perlu, tambahkan SportMonks |
| API-Football free tier (100 req/day) tidak cukup | High | Tinggi | Upgrade ke Basic ($25/bln) segera |
| The Odds API free tier (500 req/bln) tidak cukup | Medium | Sedang | Upgrade ke Starter ($30/bln) di Sprint 4B |
| Provider API downtime | Low | Tinggi | Circuit breaker + retry + logging |
| Rate limit tanpa peringatan | Medium | Sedang | Header monitoring + alerting |
| Perubahan API provider | Low | Tinggi | Simpan raw JSON sebagai fallback data |
| Biaya membengkak | Low | Rendah | Kedua provider murah sampai skala besar |
