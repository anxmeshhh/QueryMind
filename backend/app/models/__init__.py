"""Data models and schema definitions for QueryMind.

These models define the shapes of data flowing through the analysis pipeline.
They are used for documentation and type-checking, not ORM persistence
(Supabase handles storage directly).
"""

from dataclasses import dataclass, field
from typing import Optional


@dataclass
class AnalysisRequest:
    """Incoming request for query analysis."""
    sql: str
    dialect: str = "postgresql"
    schema: str = ""
    project_schema: list = field(default_factory=list)


@dataclass
class ScanRequest:
    """Incoming request for project file scanning."""
    files: list = field(default_factory=list)  # [{name, content}]


@dataclass
class BatchAnalysisRequest:
    """Incoming request for batch analysis."""
    queries: list = field(default_factory=list)  # [{sql, file, line}]
    project_schema: list = field(default_factory=list)
    dialect: str = "postgresql"


@dataclass
class AntiPatternIssue:
    """A detected anti-pattern in a SQL query."""
    rule_id: int
    name: str
    severity: str  # "critical", "medium", "low"
    message: str
    suggestion: str


@dataclass
class IndexRecommendation:
    """A recommended database index."""
    table: str
    columns: list
    type: str = "btree"
    create_statement: str = ""
    reason: str = ""


@dataclass
class SchemaGuardReport:
    """Result of the Schema Integrity Guard validation."""
    safe: bool = True
    safety_score: int = 100
    warnings: list = field(default_factory=list)
    blocked: list = field(default_factory=list)
    approved: list = field(default_factory=list)
    unchanged_note: Optional[str] = None


@dataclass
class PerformancePrediction:
    """Performance score prediction for a query."""
    score_before: int = 50
    score_after: int = 75
    scalability: str = ""
    bottleneck: str = ""
    estimated_improvement: str = ""


@dataclass
class AnalysisResult:
    """Complete analysis result for a single query."""
    metadata: dict = field(default_factory=dict)
    issues: list = field(default_factory=list)
    indexes: list = field(default_factory=list)
    optimization: dict = field(default_factory=dict)
    performance: dict = field(default_factory=dict)
    guard: dict = field(default_factory=dict)
