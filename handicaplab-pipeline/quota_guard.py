"""
QuotaGuard — FREE TIER Quota Enforcement
=========================================
Tracks TWO separate counters:
1. API-Football: daily counter (resets at midnight UTC)
2. OddsPapi: monthly counter (resets on 1st of month)

Usage:
    guard = QuotaGuard(cache_dir)
    guard.check("api_football")   # raises QuotaExceededError if over limit
    guard.increment("api_football")
    guard.log_budget("api_football", 50)
"""

import json
import os
import logging
from datetime import datetime, timezone
from typing import Dict, Optional

logger = logging.getLogger(__name__)


class QuotaExceededError(Exception):
    """Raised when a quota limit has been reached."""
    pass


class QuotaGuard:
    """
    Tracks API usage against free-tier limits.
    Persists state to quota_usage.json in the cache directory.
    """

    def __init__(self, cache_dir: str):
        self.cache_dir = cache_dir
        self.quota_file = os.path.join(cache_dir, "quota_usage.json")
        self._usage = self._load()

    # ── Internal helpers ──────────────────────────────────────────────────

    def _load(self) -> Dict:
        """Load quota usage from disk."""
        if os.path.exists(self.quota_file):
            try:
                with open(self.quota_file, "r", encoding="utf-8") as f:
                    return json.load(f)
            except (json.JSONDecodeError, OSError):
                pass
        return self._default_usage()

    def _save(self) -> None:
        """Persist quota usage to disk."""
        try:
            with open(self.quota_file, "w", encoding="utf-8") as f:
                json.dump(self._usage, f, indent=2)
        except OSError as e:
            logger.error(f"Failed to save quota usage: {e}")

    @staticmethod
    def _default_usage() -> Dict:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        this_month = datetime.now(timezone.utc).strftime("%Y-%m")
        return {
            "api_football": {"date": today, "count": 0},
            "oddspapi": {"month": this_month, "count": 0},
        }

    # ── Public API ────────────────────────────────────────────────────────

    def check(self, service: str, limit: int) -> None:
        """
        Check if the service has exceeded its quota.
        Raises QuotaExceededError if over limit.
        """
        self._maybe_reset(service)
        current = self._usage.get(service, {}).get("count", 0)
        if current >= limit:
            raise QuotaExceededError(
                f"{service}: quota exceeded ({current}/{limit}). "
                f"HALTING pipeline to avoid hard limit breach."
            )

    def increment(self, service: str) -> None:
        """Increment the counter for a service after a successful API call."""
        self._maybe_reset(service)
        self._usage.setdefault(service, {"count": 0})
        self._usage[service]["count"] += 1
        self._save()

    def get_count(self, service: str) -> int:
        """Get current usage count for a service."""
        self._maybe_reset(service)
        return self._usage.get(service, {}).get("count", 0)

    def get_remaining(self, service: str, limit: int) -> int:
        """Get remaining calls for a service."""
        return max(0, limit - self.get_count(service))

    def log_budget(self, service: str, limit: int) -> None:
        """Log current budget status."""
        used = self.get_count(service)
        remaining = limit - used
        pct = (used / limit) * 100 if limit > 0 else 0
        logger.info(
            f"[QuotaGuard] {service}: {used}/{limit} used ({pct:.1f}%) — "
            f"{remaining} remaining"
        )

    def _maybe_reset(self, service: str) -> None:
        """Reset counter if the period has rolled over."""
        now = datetime.now(timezone.utc)

        if service == "api_football":
            today = now.strftime("%Y-%m-%d")
            stored_date = self._usage.get(service, {}).get("date")
            if stored_date != today:
                self._usage[service] = {"date": today, "count": 0}
                logger.info(f"[QuotaGuard] Reset api_football counter for new day ({today})")
                self._save()

        elif service == "oddspapi":
            this_month = now.strftime("%Y-%m")
            stored_month = self._usage.get(service, {}).get("month")
            if stored_month != this_month:
                self._usage[service] = {"month": this_month, "count": 0}
                logger.info(f"[QuotaGuard] Reset oddspapi counter for new month ({this_month})")
                self._save()

    def reset_for_testing(self) -> None:
        """Reset all counters to zero (for testing only)."""
        self._usage = self._default_usage()
        self._save()
        logger.info("[QuotaGuard] All counters reset (testing mode)")
