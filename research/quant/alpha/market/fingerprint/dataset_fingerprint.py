import hashlib
import pathlib

def fingerprint_parquet(parquet_path: str) -> str:
    """
    Returns the SHA-256 hash of a Parquet file or a directory of Parquet files.
    This guarantees data reproducibility.
    """
    p = pathlib.Path(parquet_path)
    if not p.exists():
        raise FileNotFoundError(f"Path not found: {parquet_path}")

    hasher = hashlib.sha256()
    
    if p.is_dir():
        # Hash concatenation of all files (sorted to ensure deterministic hash)
        for file in sorted(p.rglob("*.parquet")):
            with open(file, "rb") as f:
                # Read in chunks to avoid memory issues with large files
                for chunk in iter(lambda: f.read(4096), b""):
                    hasher.update(chunk)
    else:
        with open(p, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                hasher.update(chunk)
                
    return hasher.hexdigest()
