#!/bin/sh
set -e

/app/.venv/bin/python - <<'PY'
import json
import os
from pathlib import Path

base = os.environ.get("NEXT_PUBLIC_QUANT_AGENT_API", "/api").strip().rstrip("/") or "/api"
dist = Path(os.environ.get("WEB_DIST_DIR", "/app/web/out"))
dist.mkdir(parents=True, exist_ok=True)
(dist / "config.js").write_text(
    f"window.__QUANT_AGENT_API_BASE__={json.dumps(base)};",
    encoding="utf-8",
)
PY

exec uvicorn app.main:app --host "${HOST:-0.0.0.0}" --port "${PORT:-8000}"
