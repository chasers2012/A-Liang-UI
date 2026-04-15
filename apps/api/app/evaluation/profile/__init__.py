"""Evaluation schemes: profiles, workflow graphs, data sets, and execution."""

from __future__ import annotations

from multiprocessing.process import parent_process

from app.startup_jobs import register_startup_job


@register_startup_job
def _ensure_evaluation_profile_domain_node_visibility() -> None:
    if parent_process() is not None:
        return

    from app.visibility.controller import ensure_domain_node_visibility_config

    ensure_domain_node_visibility_config("evaluation-profile")


@register_startup_job
def register_evaluation_scheme_chat_tools() -> None:
    from app.evaluation.profile.tools import EVALUATION_SCHEME_CHAT_TOOLS
    from app.tool.registry import ChatToolRegistry

    for tool in EVALUATION_SCHEME_CHAT_TOOLS:
        ChatToolRegistry.instance().register_tool(tool, category="evaluation_profile")


@register_startup_job
def _seed_evaluation_profile_examples() -> None:
    # Avoid duplicated seed execution in forked/spawned worker processes.
    if parent_process() is not None:
        return

    from app.evaluation.profile.seed_examples import seed_evaluation_profile_examples

    seed_evaluation_profile_examples()
