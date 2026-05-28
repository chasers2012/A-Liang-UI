# a-liang-ui: API serves static web export (apps/web/out)
#   docker build -t a-liang-ui .
#   docker compose up -d

#############################################
# Runtime — inside-container portable layout
#############################################
FROM python:3.11-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=8000 \
    WEB_DIST_DIR=/opt/a-liang-ui_portable/web/out \
    PYTHONPATH=/opt/a-liang-ui_portable/plugins/site-packages

WORKDIR /opt/a-liang-ui_portable

# Copy prebuilt portable package from host.
# Build it first on the host with:
#   python scripts/build_standalone.py --clean
COPY dist/a-liang-ui_portable/ /opt/a-liang-ui_portable/

EXPOSE 8000

ENTRYPOINT ["./python_embeded/bin/python", "-m", "app.main"]
