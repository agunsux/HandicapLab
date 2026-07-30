# HandicapLab Python Engine

This is the Python-based backend quantitative engine for HandicapLab, prioritizing robust statistical modeling, quota-safe API fetching, and structured decision generation.

## Project Structure
- `config.py`: Hardcoded limits, API tiers, cache lengths, and thresholds.
- `quota_guard.py`: Enforces free-tier API limits across the board.
- `cache/`: File-based caching for all data fetching.
- `fetchers/`: API integration for API-Football and OddsPapi.
- `models/`: Quantitative models (e.g., Dixon-Coles).
- `engine/`: Edge detection, pick generation, and paper trading logic.
- `supabase/`: Schema definitions.
- `scripts/`: Cron entry points for fetching, closing, and settling.

## Run Instructions

1. Copy `.env.example` to `.env` and fill in API keys.
2. Install dependencies: `pip install -r requirements.txt`.
3. Run `python dry_test.py` to verify quota and cache components.
