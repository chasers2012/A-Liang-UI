# quant-agent: API serves static web export (apps/web/out)
#   docker build -t quant-agent .
#   docker compose up -d

#############################################
# Runtime — inside-container portable layout
#############################################
FROM python:3.11-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=8000 \
    WEB_DIST_DIR=/opt/quant-agent_portable/web/out \
    PYTHONPATH=/opt/quant-agent_portable/plugins/site-packages

WORKDIR /opt/quant-agent_portable

# Copy prebuilt portable package from host.
# Build it first on the host with:
#   python scripts/build_standalone.py --clean
COPY dist/quant-agent_portable/ /opt/quant-agent_portable/

EXPOSE 8000

ENTRYPOINT ["./python_embeded/bin/python", "-m", "app.main"]
