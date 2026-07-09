# Provider Comparison — Shadow Pipeline Data Sources

## Evaluation Criteria

Each provider is assessed on: coverage, odds markets, pricing, free tier, rate limits, API quality, and operational reliability.

---

## Provider Matrix

| Criteria | API-Football | The Odds API | Football-Data.org | GoalServe | SportMonks |
|----------|:-----------:|:------------:|:-----------------:|:---------:|:----------:|
| **Soccer Leagues** | 100+ | ~30 | ~20 (Tier 1 only) | 300+ | 1000+ |
| **Fixtures** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Results** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Standings** | ✅ | ❌ | ✅ | ✅ | ✅ |
| **Moneyline** | ✅ | ✅ (h2h) | ❌ | ✅ | ✅ |
| **Asian Handicap** | ✅ (dedicated) | ⚠️ (spreads only) | ❌ | ✅ | ✅ |
| **Over/Under** | ✅ | ✅ (totals) | ❌ | ✅ | ✅ |
| **Live odds** | ✅ | ✅ | ❌ | ✅ | ✅ |
| **Historical odds** | ❌ (paid) | ✅ (paid) | ❌ | ✅ | ✅ |
| **Free tier** | 100 req/day | 500 req/month | 10 req/min | 30-day trial | Limited |
| **Entry price** | ~$25/mo | $30/mo | $0 (limited) | Enterprise | ~$50/mo |
| **Rate limit** | Per plan | Per plan | 10/min | Custom | Per plan |
| **API format** | JSON/REST | JSON/REST | JSON/REST | JSON/XML | JSON/GraphQL |
| **Doc quality** | Good | Excellent | Good | Poor | Good |
| **Reliability** | High | High | High | Medium | High |

---

## Detailed Provider Analysis

### 1. API-Football (via RapidAPI)

**Strengths:**
- Widest soccer coverage (100+ leagues, including second-tier, Asian, South American)
- Dedicated Asian Handicap market endpoint
- Full odds: ML, AH, OU comprehensively available
- Standings, H2H, events, statistics
- Well-documented REST API
- High uptime

**Weaknesses:**
- Free tier: only 100 requests/day — insufficient for continuous monitoring
- Paid plans start at ~$25/month via RapidAPI
- Historical odds require higher tiers
- Rate limited per RapidAPI plan

**Sprint 4 Suitability: HIGH (for non-odds data)**
- ✅ Coverage pertandingan terlengkap (100+ leagues)
- ✅ Lineups, injuries, xG, standings, H2H
- ✅ Data pelengkap untuk feature engineering
- ⚠️ Free tier (100 req/hari) cukup untuk testing saja
- ✅ Paid plan ($25/bulan) cukup untuk data fixtures harian
- ❌ **Tidak diandalkan untuk odds** — coverage per liga tidak konsisten


---

### 2. The Odds API

**Strengths:**
- Generous free tier: 500 requests/month
- Excellent documentation with Swagger/OpenAPI
- Multiple sports (not just soccer)
- Multiple bookmakers including Pinnacle
- Historical odds available on paid plans
- Simple, clean REST API

**Weaknesses:**
- **No Asian Handicap** — uses "spreads" (point spreads) which resolve differently
- Spreads are half-point only, not AH quarter-point resolution
- Fewer soccer leagues (~30)
- No standings endpoint
- No extended match stats (xG, shots, etc.)

**Sprint 4 Suitability: PRIMARY ODDS SOURCE — HIGH**
- ✅ Moneyline (h2h) — konsisten untuk semua pertandingan
- ✅ Over/Under (totals) — konsisten untuk semua pertandingan
- ✅ Asian Handicap via spreads — konsisten untuk semua pertandingan
- ✅ Historical odds untuk backtesting (paid tier)
- ✅ Multi-bookmaker untuk vig removal dan CLV akurat
- ✅ Free tier: 500 req/bulan — cukup untuk Sprint 4A testing
- ✅ Starter $30/bulan: 20.000 req/bulan — cukup untuk operasi penuh


---

### 3. Football-Data.org

**Strengths:**
- Free tier exists (10 req/min)
- Clean, well-documented API
- Good for fixture data and results
- No API key needed for basic access

**Weaknesses:**
- **No odds data at all** — cannot be used for odds collection
- Limited to Tier 1 leagues on free plan
- Only 10 requests/minute

**Sprint 4 Suitability: ZERO**
- ❌ No odds data — completely unsuitable for Shadow Pipeline

---

### 4. GoalServe

**Strengths:**
- Massive coverage: 300+ leagues, 20+ sports
- 30+ bookmakers
- 100+ betting markets including true Asian Handicap
- 30-day free trial full access
- In-play and pre-match odds
- 20 years in market

**Weaknesses:**
- **No free tier** — only paid enterprise plans
- Pricing is not public (likely expensive)
- Poor documentation quality
- XML format support (dated)
- Enterprise contracts, not startup-friendly

**Sprint 4 Suitability: LOW (cost prohibitive for MVP)**
- ✅ Has everything needed
- ❌ Enterprise pricing likely $500+/month

---

### 5. SportMonks

**Strengths:**
- Largest football coverage: 1000+ competitions
- Full odds including Asian Handicap
- Standings, statistics, events, lineups
- GraphQL and REST API
- Good documentation
- High reliability

**Weaknesses:**
- Limited free tier
- Paid plans start at ~$50/month
- Some features locked behind higher tiers
- APIs can be complex (GraphQL learning curve)

**Sprint 4 Suitability: MODERATE-HIGH**
- ✅ Asian Handicap available
- ✅ Over/Under available
- ✅ Moneyline available
- ⚠️ $50/mo minimum for full access

---

## Critical Comparison — Provider Specialization

| Data Domain | Recommended Provider | Alasan |
|-------------|:-------------------:|--------|
| Fixtures | API-Football | 100+ leagues vs ~30 |
| Results | API-Football | Coverage lebih luas |
| Standings | API-Football | The Odds API tidak punya |
| Lineups | API-Football | The Odds API tidak punya |
| Injuries | API-Football | The Odds API tidak punya |
| Statistics (xG, dll) | API-Football | The Odds API tidak punya |
| Moneyline odds | The Odds API | Konsisten per sport key |
| Over/Under odds | The Odds API | Konsisten per sport key |
| Asian Handicap odds | The Odds API | Konsisten per sport key |
| Historical odds | The Odds API (paid) | Snapshot back to 2020 |

**Keputusan arsitektur**: Dua provider independen, bukan hierarki primary/fallback. Masing-masing menangani domain yang sesuai dengan keunggulannya.

---

## Cost Comparison for Sprint 4 (estimated 3 months)

| Provider | Monthly | 3 Month Cost | Notes |
|----------|:-------:|:------------:|-------|
| The Odds API (Free) | $0 | $0 | 500 req/month — may be enough for light use |
| The Odds API (Starter) | $30 | $90 | 20K credits |
| API-Football (Basic) | ~$25 | ~$75 | Via RapidAPI |
| SportMonks (Starter) | ~$50 | ~$150 | |
| GoalServe (Enterprise) | ~$500+ | ~$1500+ | Price unknown, estimated high |
