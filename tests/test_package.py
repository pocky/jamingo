"""Release guardrails exercised against the actual installable archive."""

import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

ROOT = Path(__file__).resolve().parent.parent
CHECK = ROOT / "scripts/check-package.py"


class PackageTests(unittest.TestCase):
    def run_check(self, *arguments):
        return subprocess.run(
            [sys.executable, str(CHECK), *map(str, arguments)],
            cwd=ROOT, capture_output=True, text=True,
        )

    def test_release_tag_must_match_the_extension(self):
        version = json.loads((ROOT / "manifest.json").read_text())["version"]
        self.assertEqual(self.run_check("--tag", f"v{version}").returncode, 0)
        for tag in ["v999.0.0", version, "v1.0.0; echo unsafe"]:
            with self.subTest(tag=tag):
                self.assertNotEqual(self.run_check("--tag", tag).returncode, 0)

    def test_built_zip_and_checksum(self):
        archive = ROOT / "dist/jamingo.zip"
        result = self.run_check("--archive", archive)
        self.assertEqual(result.returncode, 0, result.stderr)
        expected = f"{hashlib.sha256(archive.read_bytes()).hexdigest()}  jamingo.zip\n"
        self.assertEqual((ROOT / "dist/SHA256SUMS").read_text(), expected)
        with zipfile.ZipFile(archive) as bundle:
            self.assertIn("LICENSE", bundle.namelist())
            self.assertIn("manifest.json", bundle.namelist())

    def test_private_extra_stale_and_missing_entries_are_rejected(self):
        with zipfile.ZipFile(ROOT / "dist/jamingo.zip") as original:
            files = {item.filename: original.read(item) for item in original.infolist() if not item.is_dir()}
        changes = {
            "private": {**files, ".tower/daemon.log": b"private"},
            "stale": {**files, "manifest.json": b"{}"},
            "missing": {name: data for name, data in files.items() if name != "icons/icon-16.png"},
        }
        with tempfile.TemporaryDirectory() as directory:
            for case, entries in changes.items():
                with self.subTest(case=case):
                    archive = Path(directory) / f"{case}.zip"
                    with zipfile.ZipFile(archive, "w") as bundle:
                        for name, data in entries.items():
                            bundle.writestr(name, data)
                    self.assertNotEqual(self.run_check("--archive", archive).returncode, 0)


if __name__ == "__main__":
    unittest.main()
