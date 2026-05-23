"""GitHub repository scanner — clones public repos and extracts source files."""

import os
import shutil
import tempfile
import subprocess
from pathlib import Path


SCANNABLE_EXTENSIONS = {
    ".py", ".js", ".ts", ".tsx", ".jsx", ".java", ".go",
    ".rb", ".php", ".sql", ".rs", ".kt", ".cs", ".c", ".cpp",
}

MAX_FILE_SIZE = 500_000  # 500KB per file
MAX_FILES = 50


def scan_github_repo(repo_url: str) -> list[dict]:
    """
    Clone a public GitHub repo to a temp directory, scan for source files,
    and return their contents as a list of {name, content, size} dicts.
    """
    # Validate URL format
    repo_url = repo_url.strip()
    if not repo_url.startswith(("https://github.com/", "http://github.com/")):
        raise ValueError("Only public GitHub URLs are supported (https://github.com/owner/repo)")

    # Normalize: strip trailing slashes, .git suffix
    if repo_url.endswith("/"):
        repo_url = repo_url.rstrip("/")
    if not repo_url.endswith(".git"):
        repo_url = repo_url + ".git"

    tmp_dir = tempfile.mkdtemp(prefix="qm_github_")

    try:
        # Shallow clone (depth 1) for speed
        result = subprocess.run(
            ["git", "clone", "--depth", "1", repo_url, tmp_dir],
            capture_output=True,
            text=True,
            timeout=60,
        )

        if result.returncode != 0:
            error_msg = result.stderr.strip()
            if "not found" in error_msg.lower() or "does not exist" in error_msg.lower():
                raise ValueError("Repository not found. Make sure it is a valid public GitHub URL.")
            raise ValueError(f"Failed to clone repository: {error_msg[:200]}")

        # Walk the directory and collect source files
        files = []
        repo_path = Path(tmp_dir)

        for fpath in sorted(repo_path.rglob("*")):
            if not fpath.is_file():
                continue

            # Skip hidden dirs (.git, .github, etc)
            rel = fpath.relative_to(repo_path)
            if any(part.startswith(".") for part in rel.parts):
                continue

            # Skip common non-source dirs
            skip_dirs = {"node_modules", "vendor", "venv", "__pycache__", "dist", "build", ".next", "target"}
            if any(part in skip_dirs for part in rel.parts):
                continue

            # Check extension
            if fpath.suffix.lower() not in SCANNABLE_EXTENSIONS:
                continue

            # Check file size
            size = fpath.stat().st_size
            if size > MAX_FILE_SIZE or size == 0:
                continue

            try:
                content = fpath.read_text(encoding="utf-8", errors="ignore")
                files.append({
                    "name": str(rel).replace("\\", "/"),
                    "content": content,
                    "size": size,
                })
            except Exception:
                continue

            if len(files) >= MAX_FILES:
                break

        return files

    finally:
        # Clean up temp directory
        try:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass
