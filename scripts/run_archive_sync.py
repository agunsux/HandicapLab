"""
HandicapLab - ScoreRoom Archive Sync Orchestrator (Root Wrapper)
"""
import sys
from pathlib import Path

# Add workspace root and python_engine to path
workspace_root = Path(__file__).resolve().parent.parent
engine_dir = workspace_root / "python_engine"

for p in (workspace_root, engine_dir):
    if str(p) not in sys.path:
        sys.path.insert(0, str(p))

from python_engine.scripts.run_archive_sync import main

if __name__ == "__main__":
    main()
