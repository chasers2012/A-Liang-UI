"""Evaluation schemes: profiles, workflow graphs, data sets, and execution."""

from __future__ import annotations

from multiprocessing.process import parent_process

import app.tool.controller as tool_controller
from app.evaluation.profile.seed_examples import seed_evaluation_profile_examples
from app.evaluation.profile.tools import TOOLS
from app.startup_jobs import register_startup_job
from app.visibility.controller import ensure_domain_node_visibility_config


@register_startup_job
def _ensure_evaluation_profile_domain_node_visibility() -> None:
    if parent_process() is not None:
        return

    ensure_domain_node_visibility_config("evaluation-profile")


@register_startup_job
def register_evaluation_scheme_chat_tools() -> None:
    tool_controller.register_tools(
        TOOLS,
        category="评价方案",
    )


@register_startup_job
def _seed_evaluation_profile_examples() -> None:
    # Avoid duplicated seed execution in forked/spawned worker processes.
    if parent_process() is not None:
        return

    seed_evaluation_profile_examples()
