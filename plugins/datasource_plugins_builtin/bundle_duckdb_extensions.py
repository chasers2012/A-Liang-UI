"""Build-time: INSTALL DuckDB extensions and copy artifacts into the package wheel.

Invoked by the Hatch custom build hook (see hatch_build.py). Not used at API runtime.
"""

from __future__ import annotations

import shutil
import sys
from pathlib import Path

import duckdb

# INSTALL / LOAD names used by SQL drivers (see sql.SQL_DRIVERS[].duckdb_extension).
_EXTENSIONS_TO_BUNDLE: tuple[str, ...] = ("postgres", "mysql")


def _install_path(con: duckdb.DuckDBPyConnection, install_name: str) -> Path:
    con.execute(f"INSTALL {install_name}")
    scanner_name = f"{install_name}_scanner"
    row = con.execute(
        "SELECT install_path FROM duckdb_extensions() WHERE extension_name = ? AND installed",
        [scanner_name],
    ).fetchone()
    if not row or not row[0]:
        raise RuntimeError(
            f"DuckDB extension {install_name!r} 安装后未找到 {scanner_name!r} 的 install_path"
        )
    return Path(str(row[0]))


def bundle_extensions(*, out_dir: Path) -> None:
    out_dir.mkdir(parents=True, exist_ok=True)
    for old in out_dir.glob("*.duckdb_extension"):
        old.unlink()

    con = duckdb.connect()
    try:
        for name in _EXTENSIONS_TO_BUNDLE:
            src = _install_path(con, name)
            dest = out_dir / src.name
            shutil.copy2(src, dest)
            print(f"bundled {name}: {dest}", file=sys.stderr)
    finally:
        con.close()


def main() -> None:
    pkg_root = Path(__file__).resolve().parent
    out = pkg_root / "datasource_plugins_builtin" / "_bundled_extensions"
    bundle_extensions(out_dir=out)


if __name__ == "__main__":
    main()
