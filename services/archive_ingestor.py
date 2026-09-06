"""
HandicapLab - Archive Ingestor (Root Wrapper)
"""
import sys
from pathlib import Path

engine_dir = Path(__file__).resolve().parent.parent / "python_engine"
if str(engine_dir) not in sys.path:
    sys.path.insert(0, str(engine_dir))

from python_engine.services.archive_ingestor import ArchiveIngestor  # noqa: F401

__all__ = ["ArchiveIngestor"]
