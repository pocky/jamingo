#!/usr/bin/env python3
"""Validate release metadata and the exact contents of the installable ZIP."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import struct
import sys
import zipfile

ROOT = Path(__file__).resolve().parent.parent


def check(tag=None, archive=None, checksum=None):
    manifest = json.loads((ROOT / "manifest.json").read_text())
    package = json.loads((ROOT / "package.json").read_text())
    lock = json.loads((ROOT / "package-lock.json").read_text())
    version = manifest["version"]
    if not re.fullmatch(r"\d+\.\d+\.\d+", version):
        raise ValueError("Expected a three-part numeric extension version")
    if any(item["version"] != version for item in [package, lock, lock["packages"][""]]):
        raise ValueError("Manifest, package and lockfile versions must match")
    if package["name"] != "jamingo" or lock["name"] != "jamingo":
        raise ValueError("Unexpected package name")
    if tag is not None and tag != f"v{version}":
        raise ValueError(f"Release tag must be v{version}, received {tag}")

    references = [manifest["background"]["service_worker"]]
    references += [script for group in manifest["content_scripts"] for script in group["js"]]
    icon_sets = [manifest["icons"], manifest["action"]["default_icon"]]
    for icons in icon_sets:
        for size, filename in icons.items():
            references.append(filename)
            data = (ROOT / filename).read_bytes()
            if data[:8] != b"\x89PNG\r\n\x1a\n" or struct.unpack(">II", data[16:24]) != (int(size), int(size)):
                raise ValueError(f"Invalid PNG icon or dimensions: {filename}")
    if any(not (ROOT / filename).is_file() for filename in references):
        raise ValueError("A file referenced by the manifest is missing")

    if archive is not None:
        expected = {"manifest.json", "README.md", "LICENSE", *references}
        for directory in ["icons", "docs"]:
            expected.update(path.relative_to(ROOT).as_posix() for path in (ROOT / directory).rglob("*") if path.is_file())
        with zipfile.ZipFile(archive) as bundle:
            files = [item.filename for item in bundle.infolist() if not item.is_dir()]
            if len(files) != len(set(files)) or set(files) != expected:
                raise ValueError(f"Unexpected ZIP contents: missing={expected - set(files)}, extra={set(files) - expected}")
            if bundle.testzip() is not None:
                raise ValueError("Corrupt ZIP entry")
            for filename in files:
                if bundle.read(filename) != (ROOT / filename).read_bytes():
                    raise ValueError(f"Stale archive entry: {filename}")
        if checksum is not None:
            digest = hashlib.sha256(Path(archive).read_bytes()).hexdigest()
            Path(checksum).write_text(f"{digest}  {Path(archive).name}\n")
    elif checksum is not None:
        raise ValueError("--checksum requires --archive")
    print(f"Jamingo {version}: metadata" + (" and ZIP verified" if archive else " verified"))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--tag")
    parser.add_argument("--archive", type=Path)
    parser.add_argument("--checksum", type=Path)
    args = parser.parse_args()
    try:
        check(args.tag, args.archive, args.checksum)
    except (ValueError, KeyError, OSError, zipfile.BadZipFile, struct.error) as error:
        print(f"Package validation failed: {error}", file=sys.stderr)
        sys.exit(1)
