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
    from app.evaluation.profile.tools import (
        create_evaluation_profile,
        delete_evaluation_profile,
        get_evaluation_profile_detail,
        get_evaluation_profile_list,
        get_evaluation_profile_workflow_template,
        get_workflow_node_types_source,
        update_evaluation_profile,
    )
    from app.tool.models import ToolAuthorization
    from app.tool.registry import ChatToolRegistry

    tool_defs = [
        (
            "evaluation_profile.get_evaluation_profile_workflow_template",
            get_evaluation_profile_workflow_template,
            ToolAuthorization.allowed,
        ),
        (
            "evaluation_profile.get_workflow_node_types_source",
            get_workflow_node_types_source,
            ToolAuthorization.allowed,
        ),
        (
            "evaluation_profile.create_evaluation_profile",
            create_evaluation_profile,
            ToolAuthorization.allowed,
        ),
        (
            "evaluation_profile.get_evaluation_profile_detail",
            get_evaluation_profile_detail,
            ToolAuthorization.allowed,
        ),
        (
            "evaluation_profile.get_evaluation_profile_list",
            get_evaluation_profile_list,
            ToolAuthorization.allowed,
        ),
        (
            "evaluation_profile.update_evaluation_profile",
            update_evaluation_profile,
            ToolAuthorization.need_authorize,
        ),
        (
            "evaluation_profile.delete_evaluation_profile",
            delete_evaluation_profile,
            ToolAuthorization.disabled,
        ),
    ]
    for tool_id, tool, authorization in tool_defs:
        ChatToolRegistry.instance().register_tool(
            tool,
            name=tool_id,
            category="评价方案",
            authorization=authorization,
        )


@register_startup_job
def _seed_evaluation_profile_examples() -> None:
    # Avoid duplicated seed execution in forked/spawned worker processes.
    if parent_process() is not None:
        return

    from app.evaluation.profile.seed_examples import seed_evaluation_profile_examples

    seed_evaluation_profile_examples()
