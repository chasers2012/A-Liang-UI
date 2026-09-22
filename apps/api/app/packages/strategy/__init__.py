from __future__ import annotations

from multiprocessing.process import parent_process

import app.packages.tool.controller as tool_controller
from app.startup_jobs import register_startup_job
from app.packages.strategy.constants import WORKFLOW_STRATEGY_DOMAIN
from app.packages.strategy.skills import register_strategy_skills
from app.packages.strategy.tools import TOOLS
from app.packages.visibility.controller import ensure_domain_node_visibility_config

register_strategy_skills()


@register_startup_job
def _ensure_strategy_domain_node_visibility() -> None:
    if parent_process() is not None:
        return

    ensure_domain_node_visibility_config(WORKFLOW_STRATEGY_DOMAIN)


@register_startup_job
def register_strategy_chat_tools() -> None:
    tool_controller.register_tools(
        TOOLS,
        category="策略",
    )
