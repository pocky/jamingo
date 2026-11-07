#!/usr/bin/env python3
"""Package explicitly selected paths while preserving their relative folders."""

from pathlib import Path
import sys
import zipfile


def build(destination, sources):
    with zipfile.ZipFile(destination, "w", compression=zipfile.ZIP_DEFLATED) as archive:
        for source in sources:
            path = Path(source)
            files = sorted(path.rglob("*")) if path.is_dir() else [path]
            for filename in files:
                if filename.is_file():
                    archive.write(filename, filename.as_posix())


if __name__ == "__main__":
    if len(sys.argv) < 3:
        sys.exit("Usage: build-package.py DESTINATION SOURCE [SOURCE ...]")
    build(sys.argv[1], sys.argv[2:])
