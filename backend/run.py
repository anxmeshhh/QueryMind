"""Run the QueryMind backend server."""
import sys
import os

# Ensure the backend directory is in Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app.main import app
from app.config import Config

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=Config.DEBUG)
