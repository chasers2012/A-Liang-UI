from __future__ import annotations

from app.packages.data_sync.constants import DATASOURCE_SYNC_TASK_TYPE
from app.packages.data_sync.handler import datasource_sync_handler
from app.packages.scheduler.handlers import register_task_handler

register_task_handler(DATASOURCE_SYNC_TASK_TYPE, datasource_sync_handler)
