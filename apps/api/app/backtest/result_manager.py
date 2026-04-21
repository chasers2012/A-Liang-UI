from __future__ import annotations

import csv
import json
from contextlib import suppress
from functools import lru_cache
from pathlib import Path

import pandas as pd
from workspace import get_workspace_root

from app.backtest.engine.serialize import portfolio_to_results_dict, serialize_node_results


@lru_cache(maxsize=256)
def _count_csv_data_rows_cached(path_str: str, mtime_ns: int, size: int) -> int:
    # mtime/size 作为缓存 key 的一部分；文件更新会自动失效
    _ = (mtime_ns, size)
    path = Path(path_str)
    if not path.exists() or not path.is_file():
        return 0

    # 快速按换行统计总行数。约定：CSV 一行对应一条记录（写入时由 pandas.to_csv 保证）。
    # total_lines 包含表头行，因此 data_rows = max(total_lines - 1, 0)
    total_lines = 0
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            total_lines += chunk.count(b"\n")

    # 若文件非空且没有以换行结尾，补 1 行（最后一行）
    if size > 0:
        try:
            with path.open("rb") as f2:
                f2.seek(-1, 2)
                last = f2.read(1)
            if last != b"\n":
                total_lines += 1
        except OSError:
            # 非常小/特殊文件，忽略补偿
            pass

    return max(total_lines - 1, 0)


class BacktestResultManager:
    _instance: BacktestResultManager | None = None
    _initialized: bool = False

    def __new__(cls, *args: object, **kwargs: object) -> BacktestResultManager:
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(
        self, *, workspace_root: Path | None = None, artifact_dir_name: str = "backtest_results"
    ) -> None:
        if self.__class__._initialized:
            return
        self._workspace_root = workspace_root or Path(get_workspace_root())
        self._artifact_dir = self._workspace_root / artifact_dir_name
        self.__class__._initialized = True

    @classmethod
    def instance(cls) -> BacktestResultManager:
        return cls()

    @property
    def workspace_root(self) -> Path:
        return self._workspace_root

    @property
    def artifact_dir(self) -> Path:
        return self._artifact_dir

    def run_artifact_dir(self, run_id: str) -> Path:
        return self.artifact_dir / str(run_id)

    def results_relpath_for_run(self, run_id: str) -> str:
        return str(self.run_artifact_dir(run_id).relative_to(self.workspace_root))

    def resolve_results_dir(self, results_path: str) -> Path:
        path = Path(results_path)
        if not path.is_absolute():
            path = self.workspace_root / path
        return path

    def resolve_node_dir(self, results_path: str, node_id: str) -> Path:
        return self.resolve_results_dir(results_path) / str(node_id)

    def _write_json(self, path: Path, data: object) -> None:
        path.write_text(
            json.dumps(data, ensure_ascii=False, indent=2, default=str),
            encoding="utf-8",
        )

    def _write_value(self, path: Path, value: object) -> None:
        if isinstance(value, pd.DataFrame):
            value.to_csv(path, index=True, encoding="utf-8-sig")
            return
        if isinstance(value, pd.Series):
            value.to_csv(path, index=True, encoding="utf-8-sig", header=True)
            return
        self._write_json(path, serialize_node_results(value))

    def write_node_results(self, run_id: str, node_results: object) -> str:
        run_dir = self.run_artifact_dir(run_id)
        run_dir.mkdir(parents=True, exist_ok=True)
        results_path = self.results_relpath_for_run(run_id)

        nodes = node_results.get("nodes", None) if isinstance(node_results, dict) else None
        if isinstance(nodes, dict):
            for node_id, result in nodes.items():
                node_dir = self.resolve_node_dir(results_path, str(node_id))
                node_dir.mkdir(parents=True, exist_ok=True)
                if isinstance(result, dict):
                    for key, value in result.items():
                        file_path = node_dir / (
                            f"{key}.csv"
                            if isinstance(value, (pd.DataFrame, pd.Series))
                            else f"{key}.json"
                        )
                        self._write_value(file_path, value)
                else:
                    self._write_value(node_dir / "result.json", result)
        else:
            self._write_value(run_dir / "workflow.json", node_results)

        return results_path

    def write_portfolio_results(self, run_id: str, pf: object) -> str:
        run_dir = self.run_artifact_dir(run_id)
        run_dir.mkdir(parents=True, exist_ok=True)
        self._write_json(run_dir / "portfolio.json", portfolio_to_results_dict(pf))
        return self.results_relpath_for_run(run_id)

    def read_portfolio_results(self, results_path: str) -> object | None:
        path = self.resolve_results_dir(results_path)
        portfolio_path = path / "portfolio.json"
        if not portfolio_path.exists():
            return None
        with suppress(json.JSONDecodeError):
            return json.loads(portfolio_path.read_text(encoding="utf-8"))
        return None

    def _read_csv_page(
        self,
        target_file: Path,
        *,
        page: int,
        page_size: int,
    ) -> tuple[list[str], list[list[str]], int, int]:
        # 注意：这个接口会被前端频繁分页调用。
        # 原实现会为计算 total_rows/total_pages 每次把整个 CSV 用 csv.reader 解析一遍，
        # 在大文件场景非常慢。这里改为：
        # - 先用二进制快速按换行统计行数（并带缓存）
        # - 再只用 csv.reader 解析当前页所需的行（start..end）

        # 先快速统计行数（不做 CSV 解析）
        stat = target_file.stat()
        total_rows = _count_csv_data_rows_cached(
            str(target_file),
            int(stat.st_mtime_ns),
            int(stat.st_size),
        )
        total_pages = (total_rows + page_size - 1) // page_size if total_rows > 0 else 0

        start = (page - 1) * page_size
        end = start + page_size
        if total_rows == 0 or start >= total_rows:
            # 仍需返回 headers（如果存在）以便前端渲染表头
            with target_file.open("r", encoding="utf-8-sig", newline="") as f:
                reader = csv.reader(f)
                with suppress(StopIteration):
                    headers = next(reader)
                    return [str(h).lstrip("\ufeff") for h in headers], [], total_rows, total_pages
            return [], [], total_rows, total_pages

        with target_file.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.reader(f)
            try:
                headers = next(reader)
            except StopIteration:
                return [], [], 0, 0

            rows: list[list[str]] = []
            # 只解析当前页需要的行，避免读取到文件末尾
            for idx, row in enumerate(reader):
                if idx < start:
                    continue
                if idx >= end:
                    break
                rows.append([str(v) for v in row])

        return [str(h).lstrip("\ufeff") for h in headers], rows, total_rows, total_pages

    def _read_node_file(
        self,
        run_id: str,
        node_id: str,
        target_file: Path,
        *,
        page: int,
        page_size: int,
    ) -> dict[str, object]:
        file_name = target_file.name
        suffix = target_file.suffix.lower()
        if suffix == ".csv":
            headers, rows, total_rows, total_pages = self._read_csv_page(
                target_file, page=page, page_size=page_size
            )
            return {
                "run_id": run_id,
                "node_id": node_id,
                "file": file_name,
                "kind": "csv",
                "headers": headers,
                "rows": rows,
                "pagination": {
                    "page": page,
                    "page_size": page_size,
                    "total_rows": total_rows,
                    "total_pages": total_pages,
                },
            }
        if suffix == ".json":
            with suppress(json.JSONDecodeError):
                return {
                    "run_id": run_id,
                    "node_id": node_id,
                    "file": file_name,
                    "kind": "json",
                    "content": json.loads(target_file.read_text(encoding="utf-8")),
                }
        return {
            "run_id": run_id,
            "node_id": node_id,
            "file": file_name,
            "kind": "text",
            "content": target_file.read_text(encoding="utf-8"),
        }

    def list_node_files(self, results_path: str, node_id: str) -> list[dict[str, object]]:
        node_dir = self.resolve_node_dir(results_path, node_id)
        if not node_dir.exists() or not node_dir.is_dir():
            return []

        files: list[dict[str, object]] = []
        for file_path in sorted(node_dir.iterdir(), key=lambda p: p.name):
            if not file_path.is_file():
                continue
            suffix = file_path.suffix.lower()
            if suffix == ".csv":
                files.append({"name": file_path.name, "kind": "csv", "content": None})
                continue
            if suffix == ".json":
                with suppress(json.JSONDecodeError):
                    files.append(
                        {
                            "name": file_path.name,
                            "kind": "json",
                            "content": json.loads(file_path.read_text(encoding="utf-8")),
                        }
                    )
                    continue
            files.append(
                {
                    "name": file_path.name,
                    "kind": "text",
                    "content": file_path.read_text(encoding="utf-8"),
                }
            )
        return files

    def get_node_output_page(
        self,
        *,
        run_id: str,
        results_path: str,
        node_id: str,
        file_name: str | None,
        page: int,
        page_size: int,
    ) -> dict[str, object]:
        node_dir = self.resolve_node_dir(results_path, node_id)
        if not node_dir.exists() or not node_dir.is_dir():
            return {"run_id": run_id, "node_id": node_id, "files": []}

        if file_name:
            target_file = node_dir / file_name
            if not target_file.exists() or not target_file.is_file():
                raise FileNotFoundError(
                    f"backtest node 输出文件不存在: run_id={run_id}, node_id={node_id}, file={file_name}"
                )
            return self._read_node_file(
                run_id,
                node_id,
                target_file,
                page=page,
                page_size=page_size,
            )

        return {
            "run_id": run_id,
            "node_id": node_id,
            "files": self.list_node_files(results_path, node_id),
        }


__all__ = ["BacktestResultManager"]
