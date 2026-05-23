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
    run_batch_analysis,
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

    # ── OTP Verification for Google Signups ──────────────
    import random
    import time
    active_otps = {}

    @app.route("/api/v1/send-otp", methods=["POST"])
    def send_otp():
        try:
            data = request.get_json()
            if not data or "email" not in data:
                return jsonify({"error": "Email is required"}), 400
            
            email = data["email"]
            code = f"{random.randint(100000, 999999)}"
            active_otps[email] = {
                "code": code,
                "expires_at": time.time() + 600
            }
            
            import sys
            print(f"[OTP SEND] Code for {email} is: {code}", file=sys.stderr, flush=True)
            
            smtp_ok = bool(Config.SMTP_USER and Config.SMTP_PASSWORD)
            if smtp_ok:
                try:
                    import smtplib
                    from email.mime.text import MIMEText
                    from email.mime.multipart import MIMEMultipart
                    
                    msg = MIMEMultipart("alternative")
                    msg["Subject"] = "QueryMind - Verify Your Account"
                    msg["From"] = Config.SMTP_FROM
                    msg["To"] = email
                    
                    plain = "Your QueryMind OTP code is: " + code + "\nThis code expires in 10 minutes."
                    html = (
                        '<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;'
                        'padding:32px;background:#0a0a0f;border:1px solid #1e1e2e;border-radius:12px;">'
                        '<h2 style="color:#e4e4e7;text-align:center;">Verify Your Account</h2>'
                        '<p style="color:#71717a;text-align:center;">Enter this code to complete registration:</p>'
                        '<div style="background:#1a1a2e;border:1px solid #2e2e3e;border-radius:8px;'
                        'padding:20px;text-align:center;margin:24px 0;">'
                        '<span style="font-family:monospace;font-size:32px;font-weight:bold;'
                        'letter-spacing:8px;color:#7c3aed;">' + code + '</span></div>'
                        '<p style="color:#52525b;text-align:center;font-size:12px;">'
                        'Expires in 10 minutes.</p></div>'
                    )
                    msg.attach(MIMEText(plain, "plain"))
                    msg.attach(MIMEText(html, "html"))
                    
                    with smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT) as server:
                        server.starttls()
                        server.login(Config.SMTP_USER, Config.SMTP_PASSWORD)
                        server.send_message(msg)
                    print(f"[OTP] Email sent to {email}", file=sys.stderr, flush=True)
                except Exception as smtp_err:
                    print(f"[SMTP ERROR] {smtp_err}", file=sys.stderr, flush=True)
            
            return jsonify({
                "status": "sent",
                "sandbox": not smtp_ok,
                "code": code if not smtp_ok else None
            })
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    @app.route("/api/v1/verify-otp", methods=["POST"])
    def verify_otp():
        try:
            data = request.get_json()
            if not data or "email" not in data or "code" not in data:
                return jsonify({"error": "Email and code are required"}), 400
                
            email = data["email"]
            code = str(data["code"]).strip()
            
            record = active_otps.get(email)
            if not record:
                return jsonify({"error": "No OTP code request found for this email"}), 400
                
            if time.time() > record["expires_at"]:
                active_otps.pop(email, None)
                return jsonify({"error": "OTP code has expired"}), 400
                
            if record["code"] != code:
                return jsonify({"error": "Invalid OTP code"}), 400
                
            active_otps.pop(email, None)
            return jsonify({"status": "verified"})
        except Exception as e:
            return jsonify({"error": str(e)}), 500

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

    # ── Batch Analyze (SSE) ───────────────────────────────
    @app.route("/api/v1/analyze-batch", methods=["POST"])
    def analyze_batch():
        """Batch analysis: analyze multiple queries with shared project context."""
        try:
            data = request.get_json()
            if not data:
                return jsonify({"error": "Request body required"}), 400

            queries = data.get("queries", [])
            if not queries:
                return jsonify({"error": "No queries provided"}), 400
            if len(queries) > 50:
                return jsonify({"error": "Too many queries (max 50 per batch)"}), 400

            project_schema = data.get("project_schema", [])
            dialect = data.get("dialect", "postgresql")

            if dialect not in ("postgresql", "mysql", "sqlite"):
                return jsonify({"error": "Invalid dialect"}), 400

            def generate():
                try:
                    for event in run_batch_analysis(queries, project_schema, dialect):
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

    # ── GitHub Repo Scanner ──────────────────────────────
    @app.route("/api/v1/scan-github", methods=["POST"])
    def scan_github():
        """Clone a public GitHub repo and return its source files."""
        try:
            data = request.get_json()
            if not data or "repo_url" not in data:
                return jsonify({"error": "repo_url is required"}), 400

            from app.services.github_scanner import scan_github_repo
            files = scan_github_repo(data["repo_url"])

            if not files:
                return jsonify({"error": "No scannable source files found in this repository"}), 400

            return jsonify({
                "status": "ok",
                "files": files,
                "count": len(files),
            })

        except ValueError as e:
            return jsonify({"error": str(e)}), 400
        except Exception as e:
            return jsonify({"error": f"Failed to scan repository: {str(e)}"}), 500

    return app


# Entry point
app = create_app()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=Config.DEBUG)
