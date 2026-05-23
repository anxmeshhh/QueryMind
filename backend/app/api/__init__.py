"""API route blueprints for QueryMind.

Provides versioned endpoint registration helpers for the Flask application.
Currently all routes are registered directly in main.py. This module provides
utilities for future modularization into Flask Blueprints.
"""

from flask import Blueprint

# Blueprint for v1 API — ready for migration from monolithic main.py
api_v1 = Blueprint("api_v1", __name__, url_prefix="/api/v1")


def get_api_info() -> dict:
    """Return API metadata for documentation and health endpoints."""
    return {
        "name": "QueryMind API",
        "version": "1.0.0",
        "endpoints": {
            "POST /api/v1/analyze": "Quick Analyze — paste SQL, get streaming analysis",
            "POST /api/v1/scan": "Scan Project — upload files, discover SQL queries",
            "POST /api/v1/connect": "Connect — test DB connection, discover schema",
            "POST /api/v1/explain": "EXPLAIN Analyze — run EXPLAIN on live database",
            "POST /api/v1/analyze-batch": "Batch Analyze — analyze multiple queries with project context",
            "GET  /api/v1/health": "Health check",
        },
        "agents": [
            "Parser Agent — AST decomposition via sqlglot",
            "Anti-Pattern Detector — 20 rule-based SQL checks",
            "Index Advisor — AI-powered index recommendations",
            "Query Optimizer — structural + AI rewriting",
            "Performance Predictor — heuristic + AI scoring",
            "Schema Integrity Guard — safety validation",
            "File Scanner — codebase SQL extraction",
            "DB Connector — live database introspection",
        ],
    }
