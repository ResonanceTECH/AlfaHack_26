from __future__ import annotations

import logging
import time
import uuid
from collections import defaultdict, deque
from threading import Lock

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from app.config import get_settings

logger = logging.getLogger("alfa.api")


class CorrelationIdMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next) -> Response:
        cid = request.headers.get("X-Correlation-ID") or request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.correlation_id = cid
        started = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - started) * 1000
        response.headers["X-Correlation-ID"] = cid
        logger.info(
            "method=%s path=%s status=%s duration_ms=%.1f cid=%s",
            request.method,
            request.url.path,
            response.status_code,
            elapsed_ms,
            cid,
        )
        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    def __init__(self, app):
        super().__init__(app)
        self._hits: dict[str, deque[float]] = defaultdict(deque)
        self._lock = Lock()

    async def dispatch(self, request: Request, call_next) -> Response:
        settings = get_settings()
        if request.url.path in ("/health", "/docs", "/openapi.json", "/redoc"):
            return await call_next(request)

        ip = request.headers.get("X-Forwarded-For", "").split(",")[0].strip() or (
            request.client.host if request.client else "unknown"
        )
        now = time.time()
        window = 60.0
        limit = settings.rate_limit_per_minute

        with self._lock:
            q = self._hits[ip]
            while q and now - q[0] > window:
                q.popleft()
            if len(q) >= limit:
                return JSONResponse(
                    status_code=429,
                    content={
                        "error": {
                            "code": "HTTP_429",
                            "message": "Слишком много запросов, попробуйте позже",
                            "request_id": getattr(request.state, "correlation_id", None),
                        }
                    },
                )
            q.append(now)

        return await call_next(request)
