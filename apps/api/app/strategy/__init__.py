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

    # Best-effort: pick a default factor if available so the example can run out of box.
    try:
        from app.factors.registry import FactorItemsRegistry

        factors = FactorItemsRegistry.list_items()
        if factors:
            factor_id = factors[0].id
            for n in wf.get("nodes", []):
                if isinstance(n, dict) and n.get("id") == "factor":
                    params = n.get("params")
                    if isinstance(params, dict):
                        params.setdefault("factor_id", factor_id)
                    else:
                        n["params"] = {"factor_id": factor_id}
                    break
    except Exception:
        pass

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
    from app.strategy.tools import STRATEGY_CHAT_TOOLS
    from app.tool.registry import ChatToolRegistry

    for tool in STRATEGY_CHAT_TOOLS:
        ChatToolRegistry.instance().register_tool(tool, category="strategies")
