"""
Local File-Based JSON Cache
============================
The core cost-saver. Every API response is cached to disk with a TTL.
If a fresh cache entry exists → 0 API calls for that resource.

Cache files are stored as JSON in the cache/ directory.
"""

import json
import os
import time
import logging
from typing import Any, Optional

logger = logging.getLogger(__name__)


class LocalCache:
    """File-based JSON cache with TTL support."""

    def __init__(self, cache_dir: str):
        self.cache_dir = cache_dir
        os.makedirs(cache_dir, exist_ok=True)

    def _path(self, key: str) -> str:
        """Convert a cache key to a safe file path."""
        # Replace any path separators with underscores
        safe_key = key.replace("/", "_").replace("\\", "_").replace(":", "_")
        return os.path.join(self.cache_dir, f"{safe_key}.json")

    def get(self, key: str, ttl: int) -> Optional[Any]:
        """
        Retrieve a cached value. Returns None if:
        - File doesn't exist
        - TTL has expired
        - JSON is corrupted
        """
        path = self._path(key)
        if not os.path.exists(path):
            return None

        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)

            # Check expiry
            cached_at = data.get("_cached_at", 0)
            age = time.time() - cached_at

            if age > ttl:
                logger.debug(f"Cache expired for {key} (age={age:.0f}s > ttl={ttl}s)")
                return None

            logger.debug(f"Cache HIT for {key} (age={age:.0f}s)")
            return data.get("value")

        except (json.JSONDecodeError, KeyError, OSError) as e:
            logger.warning(f"Cache read error for {key}: {e}")
            return None

    def set(self, key: str, value: Any) -> None:
        """Store a value in the cache with current timestamp."""
        path = self._path(key)
        data = {
            "_cached_at": time.time(),
            "value": value,
        }
        try:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, default=str)
            logger.debug(f"Cached {key}")
        except OSError as e:
            logger.error(f"Cache write error for {key}: {e}")

    def invalidate(self, key: str) -> None:
        """Remove a cache entry."""
        path = self._path(key)
        try:
            if os.path.exists(path):
                os.remove(path)
                logger.debug(f"Invalidated cache for {key}")
        except OSError as e:
            logger.error(f"Cache invalidation error for {key}: {e}")

    def clear_all(self) -> None:
        """Clear all cache files (use with caution)."""
        count = 0
        for fname in os.listdir(self.cache_dir):
            if fname.endswith(".json"):
                try:
                    os.remove(os.path.join(self.cache_dir, fname))
                    count += 1
                except OSError:
                    pass
        logger.info(f"Cleared {count} cache files")

    def get_age(self, key: str) -> Optional[float]:
        """Get age of a cached entry in seconds. Returns None if missing."""
        path = self._path(key)
        if not os.path.exists(path):
            return None
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return time.time() - data.get("_cached_at", 0)
        except (json.JSONDecodeError, OSError):
            return None
