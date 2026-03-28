from __future__ import annotations

from urllib.parse import quote_plus

from app.datasources.schemas import SqlConfigStored


def _auth_fragment(username: str, password: str) -> str:
    if not username and not password:
        return ""
    if not username:
        return f":{quote_plus(password)}@"
    if not password:
        return f"{quote_plus(username)}@"
    return f"{quote_plus(username)}:{quote_plus(password)}@"


def build_sqlalchemy_url(sql: SqlConfigStored) -> str | None:
    """Return a SQLAlchemy URL, or None if not configured."""
    host = (sql.db_host or "").strip()
    db_name = (sql.db_name or "").strip()
    if not host or not db_name:
        return None
    user = (sql.db_username or "").strip()
    password = sql.db_password or ""
    driver = (sql.db_driver or "postgresql").lower()
    port = sql.db_port
    auth = _auth_fragment(user, password)
    db_path = quote_plus(db_name)

    if driver in ("postgres", "postgresql"):
        p = int(port) if port is not None else 5432
        return f"postgresql+psycopg://{auth}{host}:{p}/{db_path}"
    if driver in ("mysql", "mariadb"):
        p = int(port) if port is not None else 3306
        return f"mysql+pymysql://{auth}{host}:{p}/{db_path}"
    raise ValueError(f"不支持的 db_driver: {sql.db_driver!r}，请使用 postgresql 或 mysql")
