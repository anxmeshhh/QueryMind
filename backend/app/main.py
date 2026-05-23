"""QueryMind Flask Application — main entry point."""

import json
from flask import Flask, request, Response, jsonify
from flask_cors import CORS

from app.config import Config
from app.utils.sanitizer import sanitize_sql, sanitize_schema, validate_connection_string
from app.agents.orchestrator import (
    run_quick_analysis,
    run_scan_analysis,
    run_connect_test,
    run_explain_analysis,
)


def create_app() -> Flask:
    """Flask app factory."""
    app = Flask(__name__)
    app.config.from_object(Config)

    # CORS — whitelist origins
    CORS(app, origins=Config.ALLOWED_ORIGINS, supports_credentials=True)

    # ── Security headers ─────────────────────────────────
    @app.after_request
    def add_security_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if not Config.DEBUG:
            response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        return response

    # ── Health check ─────────────────────────────────────
    @app.route("/api/v1/health", methods=["GET"])
    def health():
        return jsonify({
            "status": "healthy",
            "service": "QueryMind API",
            "version": Config.APP_VERSION if hasattr(Config, 'APP_VERSION') else "1.0.0",
        })

    # ── Quick Analyze (SSE) ──────────────────────────────
    @app.route("/api/v1/analyze", methods=["POST"])
    def analyze():
        """Mode 1: Quick Analyze — paste SQL, get streaming analysis."""
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "Request body required"}), 400

            sql = sanitize_sql(data.get("sql", ""))
            schema_sql = sanitize_schema(data.get("schema", ""))
            dialect = data.get("dialect", "postgresql")

            if dialect not in ("postgresql", "mysql", "sqlite"):
                return jsonify({"error": "Invalid dialect"}), 400

            def generate():
                try:
                    for event in run_quick_analysis(sql, schema_sql, dialect):
                        yield event
                except Exception as e:
                    yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

            return Response(
                generate(),
                mimetype="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )

        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            return jsonify({"error": f"Internal error: {str(e)}"}), 500

    # ── Project Scan (SSE) ───────────────────────────────
    @app.route("/api/v1/scan", methods=["POST"])
    def scan():
        """Mode 2: Scan Project — upload files, discover SQL queries."""
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "Request body required"}), 400

            files = data.get("files", [])
            if not files:
                return jsonify({"error": "No files provided"}), 400
            if len(files) > Config.MAX_FILES:
                return jsonify({"error": f"Too many files (max {Config.MAX_FILES})"}), 400

            # Validate file sizes
            for f in files:
                if len(f.get("content", "")) > Config.MAX_FILE_SIZE:
                    return jsonify({"error": f"File {f.get('name', '?')} too large"}), 400

            def generate():
                try:
                    for event in run_scan_analysis(files):
                        yield event
                except Exception as e:
                    yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

            return Response(
                generate(),
                mimetype="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )

        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            return jsonify({"error": f"Internal error: {str(e)}"}), 500

    # ── Database Connect (SSE) ───────────────────────────
    @app.route("/api/v1/connect", methods=["POST"])
    def connect():
        """Mode 3: Connect — test connection and discover schema."""
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "Request body required"}), 400

            conn_str = validate_connection_string(data.get("connection_string", ""))

            def generate():
                try:
                    for event in run_connect_test(conn_str):
                        yield event
                except Exception as e:
                    yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

            return Response(
                generate(),
                mimetype="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )

        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            return jsonify({"error": f"Internal error: {str(e)}"}), 500

    # ── EXPLAIN Analyze (SSE) ────────────────────────────
    @app.route("/api/v1/explain", methods=["POST"])
    def explain():
        """Run EXPLAIN ANALYZE on live database + full analysis."""
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "Request body required"}), 400

            conn_str = validate_connection_string(data.get("connection_string", ""))
            sql = sanitize_sql(data.get("sql", ""))
            dialect = data.get("dialect", "postgresql")

            def generate():
                try:
                    for event in run_explain_analysis(conn_str, sql, dialect):
                        yield event
                except Exception as e:
                    yield f"data: {json.dumps({'type': 'error', 'message': str(e)})}\n\n"

            return Response(
                generate(),
                mimetype="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )

        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            return jsonify({"error": f"Internal error: {str(e)}"}), 500

    return app


# Entry point
app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=Config.DEBUG)
