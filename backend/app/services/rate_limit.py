from __future__ import annotations

import logging
import time
from threading import Lock
from typing import Optional

from app.config import get_settings

logger = logging.getLogger("alfa.ratelimit")

_mem_lock = Lock()
_mem_counters: dict[str, list[float]] = {}
_mem_locks: dict[str, float] = {}


class RateLimitExceeded(Exception):
    def __init__(self, message: str = "Слишком много запросов, попробуйте позже") -> None:
        self.message = message
        super().__init__(message)


def _redis_client():
    try:
        import redis

        settings = get_settings()
        return redis.Redis.from_url(settings.redis_url, decode_responses=True, socket_connect_timeout=0.5)
    except Exception:
        return None


def acquire_lock(key: str, ttl_seconds: float = 5.0) -> bool:
    r = _redis_client()
    full = f"alfa:lock:{key}"
    if r is not None:
        try:
            return bool(r.set(full, "1", nx=True, ex=max(1, int(ttl_seconds))))
        except Exception as exc:
            logger.warning("redis_lock_fallback err=%s", type(exc).__name__)

    now = time.time()
    with _mem_lock:
        expires = _mem_locks.get(full, 0)
        if expires > now:
            return False
        _mem_locks[full] = now + ttl_seconds
        return True


def release_lock(key: str) -> None:
    r = _redis_client()
    full = f"alfa:lock:{key}"
    if r is not None:
        try:
            r.delete(full)
        except Exception:
            pass
    with _mem_lock:
        _mem_locks.pop(full, None)


def hit(key: str, *, limit: int, window_seconds: int) -> None:
    r = _redis_client()
    full = f"alfa:rl:{key}"
    if r is not None:
        try:
            pipe = r.pipeline()
            pipe.incr(full)
            pipe.expire(full, window_seconds, nx=True)
            count, _ = pipe.execute()
            if int(count) > limit:
                raise RateLimitExceeded()
            return
        except RateLimitExceeded:
            raise
        except Exception as exc:
            logger.warning("redis_rl_fallback err=%s", type(exc).__name__)

    now = time.time()
    with _mem_lock:
        bucket = _mem_counters.setdefault(full, [])
        cutoff = now - window_seconds
        _mem_counters[full] = [t for t in bucket if t > cutoff]
        if len(_mem_counters[full]) >= limit:
            raise RateLimitExceeded()
        _mem_counters[full].append(now)


def check_otp_send_limits(*, destination: str, ip: Optional[str]) -> None:
    hit(f"otp:dest:{destination}", limit=5, window_seconds=3600)
    hit(f"otp:dest_day:{destination}", limit=15, window_seconds=86400)
    if ip:
        hit(f"otp:ip:{ip}", limit=20, window_seconds=3600)


def reset_rate_limits() -> None:
    global _mem_counters, _mem_locks
    with _mem_lock:
        _mem_counters.clear()
        _mem_locks.clear()
    r = _redis_client()
    if r is None:
        return
    try:
        for pattern in ("alfa:rl:*", "alfa:lock:*"):
            keys = list(r.scan_iter(match=pattern, count=200))
            if keys:
                r.delete(*keys)
    except Exception as exc:
        logger.warning("redis_rl_reset_failed err=%s", type(exc).__name__)
