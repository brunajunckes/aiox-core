"""
Request/Response Caching System
===============================

Caches LLM responses based on prompt hash:
1. TTL: 24 hours
2. Max size: 100MB
3. Storage: File-based (JSON)
4. Hash-based lookup (SHA256)
5. Automatic eviction on TTL
"""
import json
import hashlib
import time
import os
import logging
from typing import Optional, Dict
from pathlib import Path

log = logging.getLogger("cache")


class ResponseCache:
    """Cache for LLM responses."""

    def __init__(
        self,
        cache_dir: str = "/var/cache/autoflow",
        ttl_hours: int = 24,
        max_size_mb: int = 100,
    ):
        """
        Initialize response cache.

        Args:
            cache_dir: Directory to store cache files
            ttl_hours: Time-to-live in hours (default: 24)
            max_size_mb: Max cache size in MB (default: 100)
        """
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)

        self.ttl_seconds = ttl_hours * 3600
        self.max_size_bytes = max_size_mb * 1024 * 1024
        self.manifest_file = self.cache_dir / "manifest.json"

        self.manifest = self._load_manifest()

    def get(
        self,
        prompt: str,
        system: str = "",
        model: str = "qwen2.5:7b",
    ) -> Optional[str]:
        """
        Get cached response if available and valid.

        Args:
            prompt: User prompt
            system: System prompt
            model: Model used

        Returns:
            Cached response or None if not found/expired
        """
        key = self._hash_request(prompt, system, model)

        if key not in self.manifest:
            return None

        entry = self.manifest[key]
        now = time.time()

        # Check TTL
        if now - entry["created_at"] > self.ttl_seconds:
            log.debug(f"[CACHE] Miss (expired): {key[:8]}...")
            self._remove_entry(key)
            return None

        # Load from disk
        cache_file = self.cache_dir / f"{key}.json"
        if not cache_file.exists():
            log.warning(f"[CACHE] Miss (file missing): {key[:8]}...")
            self._remove_entry(key)
            return None

        try:
            with open(cache_file, "r") as f:
                data = json.load(f)
            log.info(f"[CACHE] Hit: {key[:8]}... (age: {(now - entry['created_at'])/3600:.1f}h)")
            return data.get("response")
        except Exception as e:
            log.error(f"[CACHE] Error reading {key}: {e}")
            return None

    def set(
        self,
        prompt: str,
        system: str,
        model: str,
        response: str,
    ) -> None:
        """
        Cache a response.

        Args:
            prompt: User prompt
            system: System prompt
            model: Model used
            response: LLM response to cache
        """
        key = self._hash_request(prompt, system, model)

        # Check size limit
        if self._get_cache_size() + len(response) > self.max_size_bytes:
            log.warning("[CACHE] Size limit reached, evicting oldest entries")
            self._evict_oldest()

        # Write to disk
        cache_file = self.cache_dir / f"{key}.json"
        data = {
            "prompt": prompt[:200],  # Truncate for manifest
            "system": system[:100],
            "model": model,
            "response": response,
            "created_at": time.time(),
            "size_bytes": len(response),
        }

        try:
            with open(cache_file, "w") as f:
                json.dump(data, f)

            # Update manifest
            self.manifest[key] = {
                "created_at": data["created_at"],
                "size_bytes": data["size_bytes"],
                "model": model,
            }
            self._save_manifest()

            log.debug(f"[CACHE] Set: {key[:8]}... ({len(response)} bytes)")

        except Exception as e:
            log.error(f"[CACHE] Error writing {key}: {e}")

    def clear(self) -> None:
        """Clear entire cache."""
        try:
            for f in self.cache_dir.glob("*.json"):
                if f.name != "manifest.json":
                    f.unlink()
            self.manifest.clear()
            self._save_manifest()
            log.info("[CACHE] Cleared")
        except Exception as e:
            log.error(f"[CACHE] Error clearing: {e}")

    def get_stats(self) -> Dict:
        """Get cache statistics."""
        size = self._get_cache_size()
        return {
            "entries": len(self.manifest),
            "size_bytes": size,
            "size_mb": round(size / 1024 / 1024, 2),
            "max_size_mb": self.max_size_bytes / 1024 / 1024,
            "ttl_hours": self.ttl_seconds / 3600,
            "cache_dir": str(self.cache_dir),
        }

    def _hash_request(self, prompt: str, system: str, model: str) -> str:
        """Generate cache key from request."""
        combined = f"{model}:{system}:{prompt}"
        return hashlib.sha256(combined.encode()).hexdigest()

    def _load_manifest(self) -> Dict:
        """Load cache manifest."""
        if not self.manifest_file.exists():
            return {}

        try:
            with open(self.manifest_file, "r") as f:
                return json.load(f)
        except Exception as e:
            log.warning(f"[CACHE] Error loading manifest: {e}")
            return {}

    def _save_manifest(self) -> None:
        """Save cache manifest."""
        try:
            with open(self.manifest_file, "w") as f:
                json.dump(self.manifest, f)
        except Exception as e:
            log.error(f"[CACHE] Error saving manifest: {e}")

    def _remove_entry(self, key: str) -> None:
        """Remove cache entry."""
        if key in self.manifest:
            del self.manifest[key]
            cache_file = self.cache_dir / f"{key}.json"
            try:
                cache_file.unlink()
            except:
                pass
            self._save_manifest()

    def _get_cache_size(self) -> int:
        """Get total cache size in bytes."""
        return sum(
            f.stat().st_size
            for f in self.cache_dir.glob("*.json")
            if f.name != "manifest.json"
        )

    def _evict_oldest(self) -> None:
        """Remove oldest entries until below limit."""
        while self._get_cache_size() > self.max_size_bytes * 0.8 and self.manifest:
            # Find oldest entry
            oldest_key = min(
                self.manifest.items(),
                key=lambda x: x[1]["created_at"]
            )[0]
            log.debug(f"[CACHE] Evicting: {oldest_key[:8]}...")
            self._remove_entry(oldest_key)


# Global instance
_cache: Optional[ResponseCache] = None


def get_cache() -> ResponseCache:
    """Get or create global cache."""
    global _cache
    if _cache is None:
        _cache = ResponseCache()
    return _cache
