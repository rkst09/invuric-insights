import threading
import time
from collections import deque


class InMemoryRateLimiter:
    def __init__(self):
        self._lock = threading.Lock()
        self._hits: dict[str, deque[float]] = {}

    def check(self, key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
        now = time.time()
        with self._lock:
            bucket = self._hits.setdefault(key, deque())
            cutoff = now - window_seconds
            while bucket and bucket[0] <= cutoff:
                bucket.popleft()

            if len(bucket) >= limit:
                retry_after = max(1, int(window_seconds - (now - bucket[0])))
                return False, retry_after

            bucket.append(now)
            return True, 0


rate_limiter = InMemoryRateLimiter()
