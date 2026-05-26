#!/usr/bin/env python3
"""Build a ComfyUI-style portable directory (embedded Python + web + plugins)."""

from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

import tomllib

REPO_ROOT = Path(__file__).resolve().parents[1]
WEB_OUT = REPO_ROOT / "apps" / "web" / "out"
DIST_DIR = REPO_ROOT / "dist"
PORTABLE_DIR = DIST_DIR / "quant-agent_portable"
PYTHON_DIR = PORTABLE_DIR / "python_embeded"
WEB_DEST = PORTABLE_DIR / "web" / "out"
PLUGIN_SITE = PORTABLE_DIR / "plugins" / "site-packages"
PLUGIN_SOURCE = PORTABLE_DIR / "plugins" / "src"

_PLUGIN_ENTRY_POINT_GROUP = "quant-agent.plugins"
_PLUGIN_COPY_IGNORE = {
    ".git",
    ".venv",
    "__pycache__",
    ".mypy_cache",
    ".ruff_cache",
    ".pytest_cache",
    "dist",
    "build",
    ".eggs",
    ".tox",
    "node_modules",
}


def _run(cmd: list[str], *, cwd: Path | None = None, env: dict[str, str] | None = None) -> None:
    print("+", " ".join(cmd), flush=True)
    subprocess.run(cmd, check=True, cwd=cwd or REPO_ROOT, env=env)


def _resolve_tool(name: str) -> str:
    for candidate in (name, f"{name}.cmd", f"{name}.exe"):
        path = shutil.which(candidate)
        if path:
            return path
    raise SystemExit(
        f"{name} is not on PATH. Install it and ensure the shell can run `{name}` before building."
    )


def portable_python_exe() -> Path:
    if sys.platform.startswith("win"):
        return PYTHON_DIR / "Scripts" / "python.exe"
    return PYTHON_DIR / "bin" / "python"


def _read_distribution_name(pyproject: Path) -> str:
    data = tomllib.loads(pyproject.read_text(encoding="utf-8"))
    name = data.get("project", {}).get("name")
    if not isinstance(name, str) or not name.strip():
        raise ValueError(f"Missing [project].name in {pyproject}")
    return name.strip()


def _has_plugin_entry_points(pyproject: Path) -> bool:
    data = tomllib.loads(pyproject.read_text(encoding="utf-8"))
    entry_points = data.get("project", {}).get("entry-points", {})
    if not isinstance(entry_points, dict):
        return False
    return _PLUGIN_ENTRY_POINT_GROUP in entry_points


def _discover_plugin_projects() -> tuple[Path, ...]:
    """Projects under ``plugins/`` that declare ``quant-agent.plugins`` entry points."""
    plugins_root = REPO_ROOT / "plugins"
    if not plugins_root.is_dir():
        return ()

    discovered: list[Path] = []
    for child in sorted(plugins_root.iterdir()):
        if not child.is_dir() or child.name.startswith("."):
            continue
        pyproject = child / "pyproject.toml"
        if not pyproject.is_file():
            continue
        if _has_plugin_entry_points(pyproject):
            discovered.append(child.resolve())
    return tuple(discovered)


def _copy_plugin_sources(*, projects: tuple[Path, ...], source_root: Path) -> list[Path]:
    source_root.mkdir(parents=True, exist_ok=True)
    copied: list[Path] = []

    def ignore(_dir: str, names: list[str]) -> set[str]:
        return {n for n in names if n in _PLUGIN_COPY_IGNORE}

    for project_dir in projects:
        dist_name = _read_distribution_name(project_dir / "pyproject.toml")
        dest = source_root / dist_name
        if dest.is_dir():
            shutil.rmtree(dest)
        shutil.copytree(project_dir, dest, ignore=ignore)
        copied.append(dest)
    return copied


def _write_plugin_pth(*, site_packages: Path, source_projects: list[Path]) -> Path:
    """Write a .pth file so PYTHONPATH on site-packages resolves plugin source trees."""
    lines: list[str] = []
    for project in source_projects:
        src = project / "src"
        lines.append(str(src if src.is_dir() else project))
    pth = site_packages / "quant_agent_plugins_src.pth"
    pth.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return pth


def install_discovered_plugins() -> Path:
    """Copy built-in plugins as source + .pth into the portable tree."""
    PLUGIN_SITE.mkdir(parents=True, exist_ok=True)

    projects = _discover_plugin_projects()
    if not projects:
        raise SystemExit(f"No plugins found under {REPO_ROOT / 'plugins'}")

    copied = _copy_plugin_sources(projects=projects, source_root=PLUGIN_SOURCE)
    pth = _write_plugin_pth(site_packages=PLUGIN_SITE, source_projects=copied)
    print(f"\nCopied {len(copied)} plugin(s) to {PLUGIN_SOURCE}", flush=True)
    print(f"Added .pth: {pth}", flush=True)
    for project_dir in projects:
        print(f"  - {_read_distribution_name(project_dir / 'pyproject.toml')}", flush=True)
    return PLUGIN_SITE


def build_web(*, skip: bool) -> None:
    if skip and (WEB_OUT / "index.html").is_file():
        print(f"Using existing web export at {WEB_OUT}", flush=True)
        return
    pnpm = _resolve_tool("pnpm")
    env = os.environ.copy()
    env.setdefault("NEXT_PUBLIC_QUANT_AGENT_API", "/api")
    _run([pnpm, "install", "--frozen-lockfile"], env=env)
    _run([pnpm, "--filter", "web", "build"], env=env)
    if not (WEB_OUT / "index.html").is_file():
        raise SystemExit(f"Web build did not produce {WEB_OUT / 'index.html'}")


def build_portable_python(*, clean: bool) -> None:
    if clean and PYTHON_DIR.is_dir():
        shutil.rmtree(PYTHON_DIR)
    PORTABLE_DIR.mkdir(parents=True, exist_ok=True)

    uv = _resolve_tool("uv")
    env = os.environ.copy()
    env["UV_PROJECT_ENVIRONMENT"] = str(PYTHON_DIR)
    cmd = [uv, "sync", "--no-dev", "--no-editable"]
    if os.environ.get("CI", "").lower() in ("1", "true", "yes"):
        cmd.append("--frozen")
    _run(cmd, env=env)

    python_exe = portable_python_exe()
    if not python_exe.is_file():
        raise SystemExit(f"Expected portable Python at {python_exe}")


def copy_web_export() -> None:
    if WEB_DEST.is_dir():
        shutil.rmtree(WEB_DEST)
    WEB_DEST.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(WEB_OUT, WEB_DEST)


def write_run_sh() -> Path:
    path = PORTABLE_DIR / "run.sh"
    path.write_text(
        """#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
export WEB_DIST_DIR="$ROOT/web/out"
export PYTHONPATH="$ROOT/plugins/site-packages${PYTHONPATH:+:$PYTHONPATH}"
export HOST="${HOST:-0.0.0.0}"
exec "$ROOT/python_embeded/bin/python" -m app.main "$@"
""",
        encoding="utf-8",
    )
    path.chmod(path.stat().st_mode | 0o111)
    return path


def write_run_bat() -> Path:
    path = PORTABLE_DIR / "run.bat"
    path.write_text(
        r"""@echo off
setlocal
cd /d "%~dp0"
set WEB_DIST_DIR=%~dp0web\out
set "PYTHONPATH=%~dp0plugins\site-packages;%PYTHONPATH%"
if not defined HOST set HOST=0.0.0.0
"%~dp0python_embeded\Scripts\python.exe" -m app.main %*
endlocal
""",
        encoding="utf-8",
    )
    return path


def write_readme() -> None:
    (PORTABLE_DIR / "README_PORTABLE.txt").write_text(
        """quant-agent portable (ComfyUI-style layout)

Extract this folder anywhere, then start:

  Windows: double-click run.bat
  Linux:   ./run.sh

Default URL: http://127.0.0.1:8000  (API + bundled web UI)

Layout:
  python_embeded/          Independent Python + dependencies (uv venv)
  web/out/                 Static frontend export
  plugins/src/             Built-in plugin source trees
  plugins/site-packages/   .pth paths for plugin imports

Install extra plugin wheels into plugins/site-packages, then restart.

Data (config, DB, models) is stored under ~/.quant-agent unless
QUANT_AGENT_WORKSPACE is set.
""",
        encoding="utf-8",
    )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--skip-web-build",
        action="store_true",
        help="Reuse apps/web/out when index.html already exists",
    )
    parser.add_argument(
        "--clean",
        action="store_true",
        help="Remove python_embeded before syncing dependencies",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    DIST_DIR.mkdir(parents=True, exist_ok=True)
    build_web(skip=args.skip_web_build)
    build_portable_python(clean=args.clean)
    copy_web_export()
    plugins = install_discovered_plugins()
    write_run_sh()
    write_run_bat()
    write_readme()
    print(f"\nPortable package: {PORTABLE_DIR}", flush=True)
    print(f"Plugins:            {plugins}", flush=True)
    if sys.platform.startswith("win"):
        print("Start: run.bat", flush=True)
    else:
        print("Start: ./run.sh", flush=True)


if __name__ == "__main__":
    main()
