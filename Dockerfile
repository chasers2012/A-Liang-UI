# quant-agent: API serves static web export (apps/web/out)
#   docker build -t quant-agent .
#   docker compose up -d

#############################################
# API — FastAPI + uv Python workspace
#############################################
FROM python:3.11-slim-bookworm AS api-builder

ENV UV_LINK_MODE=copy

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

COPY pyproject.toml uv.lock ./
COPY apps/api apps/api
COPY lib lib
COPY plugins plugins

RUN uv sync --frozen --no-dev --no-editable


#############################################
# Web — Next.js static export (apps/web/out)
#############################################
FROM node:20-bookworm-slim AS web-builder

ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:${PATH}"

RUN corepack enable

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/

RUN pnpm install --frozen-lockfile

COPY apps/web apps/web

RUN pnpm --filter web build


#############################################
# Runtime — uvicorn + static web
#############################################
FROM python:3.11-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=8000 \
    WEB_DIST_DIR=/app/web/out

WORKDIR /app

COPY --from=api-builder /app/.venv /app/.venv
ENV PATH="/app/.venv/bin:${PATH}"

COPY --from=web-builder /app/apps/web/out /app/web/out

COPY --chmod=755 scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh

EXPOSE 8000

ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
