"""Per-client request rate limiting to protect the API and database from floods.

In-memory sliding window keyed by client IP (read from X-Forwarded-For behind
Railway's proxy). Suitable for a single-instance deployment.
"""

import os
import time
from collections import defaultdict, deque

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

WINDOW_SECONDS = float(os.environ.get("RATE_LIMIT_WINDOW", "60"))
MAX_REQUESTS = int(os.environ.get("RATE_LIMIT_MAX", "240"))   # per IP per window

# Paths that should never be rate limited
_EXEMPT_PATHS = {"/", "/docs", "/openapi.json", "/redoc"}


def _client_key(request) -> str:
    # Prefer the auth token so each logged-in user gets their own bucket — important
    # on shared campus networks where many students share one public IP.
    auth = request.headers.get("authorization")
    if auth and auth.lower().startswith("bearer "):
        return "u:" + auth[7:].strip()[-32:]   # last 32 chars are enough to disambiguate
    # Anonymous (login/register): fall back to client IP (X-Forwarded-For behind proxy)
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return "ip:" + xff.split(",")[0].strip()
    return "ip:" + (request.client.host if request.client else "unknown")


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._hits: dict[str, deque] = defaultdict(deque)
        self._last_prune = time.monotonic()

    def _prune(self, now: float) -> None:
        # Drop IPs with no recent hits so the dict can't grow unbounded
        stale = [ip for ip, dq in self._hits.items() if not dq or dq[-1] <= now - WINDOW_SECONDS]
        for ip in stale:
            del self._hits[ip]
        self._last_prune = now

    async def dispatch(self, request, call_next):
        # Let CORS preflight and docs through untouched
        if request.method == "OPTIONS" or request.url.path in _EXEMPT_PATHS:
            return await call_next(request)

        now = time.monotonic()
        key = _client_key(request)
        dq = self._hits[key]

        # Evict timestamps outside the window
        cutoff = now - WINDOW_SECONDS
        while dq and dq[0] <= cutoff:
            dq.popleft()

        if len(dq) >= MAX_REQUESTS:
            retry = max(1, int(WINDOW_SECONDS - (now - dq[0])))
            return JSONResponse(
                {"detail": "Too many requests — please slow down."},
                status_code=429,
                headers={"Retry-After": str(retry)},
            )

        dq.append(now)

        # Occasional housekeeping (at most once per window)
        if now - self._last_prune > WINDOW_SECONDS:
            self._prune(now)

        return await call_next(request)
