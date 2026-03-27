"""Sync deps at repo root with uv (root .venv) and verify app import."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
from pathlib import Path

API_DIR = Path(__file__).resolve().parent
REPO_ROOT = API_DIR.parent.parent


def main() -> None:
    uv = shutil.which("uv")
    if not uv:
        print(
            "uv is not on PATH; install from https://docs.astral.sh/uv/getting-started/installation/",
            file=sys.stderr,
        )
        sys.exit(1)
    sync = [uv, "sync"]
    if os.environ.get("CI", "").lower() in ("1", "true", "yes"):
        sync.append("--frozen")
    subprocess.run(sync, check=True, cwd=REPO_ROOT)
    subprocess.run(
        [uv, "run", "python", "-c", "from app.main import app; assert app.title"],
        check=True,
        cwd=REPO_ROOT,
    )


if __name__ == "__main__":
    main()
