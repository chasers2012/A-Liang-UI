from __future__ import annotations

import os

from sqlalchemy import create_engine, text

from app.datasource.controller import resolve_csv_path
from app.datasource.schemas import DataSourceRecord
from app.datasource.sql_url import build_sqlalchemy_url


def verify_datasource(rec: DataSourceRecord) -> tuple[bool, str]:
    if not rec.enabled:
        return False, "数据源已禁用，请先启用后再测试。"

    if rec.type == "sql" and rec.sql:
        try:
            url = build_sqlalchemy_url(rec.sql)
        except ValueError as e:
            return False, str(e)
        if not url:
            return False, "未配置数据库连接：请填写主机（IP）、数据库名与端口。"
        try:
            engine = create_engine(url)
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
        except Exception as e:
            return False, f"SQL 连接失败: {e}"
        return True, "SQL 连接成功。"

    if rec.type == "csv" and rec.csv:
        p = resolve_csv_path(rec.csv.path)
        if not p.is_file():
            return False, f"文件不存在: {p}"
        try:
            if not os.access(p, os.R_OK):
                return False, f"文件不可读: {p}"
        except OSError as e:
            return False, f"无法访问路径: {e}"
        return True, f"CSV 可读: {p}"

    return False, "配置不完整。"
