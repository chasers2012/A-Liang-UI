from __future__ import annotations

from app.data_sync.constants import DATASOURCE_SYNC_TASK_TYPE
from app.data_sync.handler import datasource_sync_handler
from app.scheduler.handlers import register_task_handler

register_task_handler(DATASOURCE_SYNC_TASK_TYPE, datasource_sync_handler)
