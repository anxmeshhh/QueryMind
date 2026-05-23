"""Application configuration loaded from environment variables."""

import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    """Central configuration for QueryMind backend."""

    # Flask
    DEBUG = os.getenv("FLASK_ENV", "production") == "development"
    SECRET_KEY = os.getenv("SECRET_KEY", os.urandom(32).hex())

    # CORS
    import re
    ALLOWED_ORIGINS = [
        o.strip()
        for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173").split(",")
    ]
    if DEBUG:
        ALLOWED_ORIGINS.append(re.compile(r"^https?://localhost(:\d+)?$"))
        ALLOWED_ORIGINS.append(re.compile(r"^https?://127.0.0.1(:\d+)?$"))

    # Groq AI
    GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
    GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant")
    GROQ_MAX_TOKENS = int(os.getenv("GROQ_MAX_TOKENS", "1536"))
    GROQ_TEMPERATURE = float(os.getenv("GROQ_TEMPERATURE", "0.3"))

    # SMTP Settings
    SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD = os.getenv("SMTP_PASS", "")
    SMTP_FROM = os.getenv("SMTP_FROM", "noreply@querymind.com")

    # Auth & Encryption
    FERNET_KEY = os.getenv("FERNET_KEY", "")
    JWT_SECRET = os.getenv("JWT_SECRET", os.urandom(32).hex())
    JWT_ACCESS_TTL_MINUTES = int(os.getenv("JWT_ACCESS_TTL_MINUTES", "15"))
    JWT_REFRESH_TTL_DAYS = int(os.getenv("JWT_REFRESH_TTL_DAYS", "7"))

    # Google OAuth
    GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
    GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")

    # OTP
    OTP_ENABLED = os.getenv("OTP_ENABLED", "true").lower() == "true"

    # Limits
    MAX_QUERY_LENGTH = 50_000
    MAX_SCHEMA_LENGTH = 100_000
    MAX_FILE_SIZE = 500_000
    MAX_FILES = 20
    DB_CONNECT_TIMEOUT = 30
    DB_QUERY_TIMEOUT = 10

    # Rate limiting (requests per minute per IP)
    RATE_LIMIT_ANALYZE = 30
    RATE_LIMIT_SCAN = 10
    RATE_LIMIT_CONNECT = 5
