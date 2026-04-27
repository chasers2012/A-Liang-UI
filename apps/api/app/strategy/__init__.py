from __future__ import annotations

import json
from multiprocessing.process import parent_process

from app.common.datetime_utils import utc_now_iso
from app.startup_jobs import register_startup_job
from app.strategy.constants import WORKFLOW_STRATEGY_DOMAIN
from app.strategy.examples import example_topk_equal_weight_workflow_dict

EXAMPLE_STRATEGY_ID = "example-topk-equal-weight"


@register_startup_job
def _ensure_strategy_domain_node_visibility() -> None:
    if parent_process() is not None:
        return

    from app.visibility.controller import ensure_domain_node_visibility_config

    ensure_domain_node_visibility_config(WORKFLOW_STRATEGY_DOMAIN)


@register_startup_job
def ensure_example_strategy() -> None:
    """
    Seed a built-in example strategy so the UI has something runnable by default.

    The strategy is inserted only if missing (idempotent).
    """

    from app.persistence.sqlite_db import get_session
    from app.strategy.models import StrategyRow

    with get_session() as session:
        if session.get(StrategyRow, EXAMPLE_STRATEGY_ID) is not None:
            return

    now = utc_now_iso()
    wf = example_topk_equal_weight_workflow_dict()

    # Avoid importing strategy schemas here to keep startup lightweight and reduce optional deps.
    row = StrategyRow(
        id=EXAMPLE_STRATEGY_ID,
        name="示例：TopK 等权轮动",
        description="内置示例策略：按因子截面 TopK 选股，等权分配，按周调仓，信号滞后 1 bar。",
        workflow=json.dumps(wf, ensure_ascii=False),
        created_at=now,
        updated_at=now,
    )
    with get_session() as session:
        session.merge(row)
        session.commit()


@register_startup_job
def register_strategy_chat_tools() -> None:
    from app.strategy.tools import register_strategy_chat_tools as register_tools

    register_tools()
