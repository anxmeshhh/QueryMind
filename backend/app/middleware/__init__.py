"""Rate limiter and request validation middleware for QueryMind."""

import time
import functools
from flask import request, jsonify, g


# ── Simple in-memory rate limiter ────────────────────────────
_request_counts: dict = {}
_RATE_LIMIT = 30  # max requests per window
_RATE_WINDOW = 60  # seconds


def rate_limit(f):
    """Decorator: rate-limits API endpoints by client IP."""
    @functools.wraps(f)
    def decorated(*args, **kwargs):
        ip = request.remote_addr or "unknown"
        now = time.time()

        if ip not in _request_counts:
            _request_counts[ip] = []

        # Remove expired entries
        _request_counts[ip] = [t for t in _request_counts[ip] if now - t < _RATE_WINDOW]

        if len(_request_counts[ip]) >= _RATE_LIMIT:
            return jsonify({
                "error": "Rate limit exceeded. Please wait before making more requests.",
                "retry_after": _RATE_WINDOW,
            }), 429

        _request_counts[ip].append(now)
        return f(*args, **kwargs)
    return decorated


def validate_json(*required_fields):
    """Decorator: validates that required JSON fields are present."""
    def decorator(f):
        @functools.wraps(f)
        def decorated(*args, **kwargs):
            data = request.get_json(silent=True)
            if not data:
                return jsonify({"error": "JSON body required"}), 400

            missing = [field for field in required_fields if field not in data]
            if missing:
                return jsonify({
                    "error": f"Missing required fields: {', '.join(missing)}"
                }), 400

            g.json_data = data
            return f(*args, **kwargs)
        return decorated
    return decorator


def request_timer():
    """Before/after request hooks to measure processing time."""
    g.start_time = time.time()


def add_timing_header(response):
    """Add X-Processing-Time header to all responses."""
    if hasattr(g, "start_time"):
        elapsed = round(time.time() - g.start_time, 3)
        response.headers["X-Processing-Time"] = f"{elapsed}s"
    return response
