#!/usr/bin/env bash
# 初始化 monorepo 本地环境：pnpm（apps/web）+ uv（Python workspace）。
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

die() {
  echo "error: $*" >&2
  exit 1
}

need_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "missing '$1'. Install it and re-run this script."
}

ensure_uv() {
  if command -v uv >/dev/null 2>&1; then
    return 0
  fi
  echo "==> uv not found, installing via https://astral.sh/uv/install.sh"
  need_cmd curl
  curl -LsSf https://astral.sh/uv/install.sh | sh
  # Standalone installer places the binary here; export for the rest of this script.
  export PATH="${HOME}/.local/bin:${PATH}"
  command -v uv >/dev/null 2>&1 ||
    die "uv was installed but is not on PATH; open a new shell or add ${HOME}/.local/bin to PATH"
}

echo "==> quant-agent setup (repo: $repo_root)"

need_cmd pnpm
ensure_uv

if command -v node >/dev/null 2>&1; then
  node_major="$(node -p "process.versions.node.split('.')[0]" 2>/dev/null || echo 0)"
  if [[ "${node_major}" -lt 20 ]]; then
    die "Node.js 20+ required (found major version ${node_major})"
  fi
fi

echo "==> pnpm install"
pnpm install

if [[ ! -d "${repo_root}/.venv" ]]; then
  echo "==> uv venv (create .venv)"
  uv venv
else
  echo "==> .venv already present, skip uv venv"
fi

echo "==> uv sync (Python workspace + lockfile)"
uv sync

echo ""
echo "Done. Next:"
echo "  - Python: use 'uv run …' or: source .venv/bin/activate"
echo "  - Copy env: see .env.example (web: apps/web/.env.local; API: export or apps/api/.env)"
echo "  - Dev: pnpm run dev (or pnpm run dev:web / pnpm run dev:api)"
