from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SubagentCatalogItem:
    id: str
    title: str
    description: str
    default_tool_ids: tuple[str, ...]


SUBAGENT_CATALOG: tuple[SubagentCatalogItem, ...] = (
    SubagentCatalogItem(
        id="main_agent",
        title="Main Agent",
        description="主代理：负责理解用户需求、拆解任务并委派给各子代理。",
        default_tool_ids=(),
    ),
    SubagentCatalogItem(
        id="research",
        title="Research",
        description="用于研究问题、检索证据、比较方案并产出结论。",
        default_tool_ids=("knowledge.search",),
    ),
    SubagentCatalogItem(
        id="factor_manager",
        title="Factor Manager",
        description="用于创建、维护和查询量化因子资产。",
        default_tool_ids=(
            "factor.get_new_factor_template",
            "factor.create_factor",
            "factor.get_factor_detail",
            "factor.get_factor_list",
            "factor.update_factor",
        ),
    ),
    SubagentCatalogItem(
        id="node_manager",
        title="Node Manager",
        description="用于创建和维护工作流节点资产。",
        default_tool_ids=(
            "node.get_new_workflow_node_template",
            "node.create_workflow_node",
            "node.get_workflow_node_detail",
            "node.get_workflow_node_list",
            "node.update_workflow_node",
        ),
    ),
    SubagentCatalogItem(
        id="strategy-manager",
        title="Strategy Manager",
        description="用于创建策略、查询策略、修改策略，以及回测评估策略效果。",
        default_tool_ids=(
            "strategy.get_strategy_workflow_template",
            "strategy.get_strategy_node_catalog",
            "strategy.get_strategy_workflow_draft",
            "strategy.create_strategy",
            "strategy.get_strategy_detail",
            "strategy.load_strategy_detail",
            "strategy.get_strategy_list",
            "strategy.update_strategy",
            "strategy.workflow.add_node",
            "strategy.workflow.draft_node",
            "strategy.workflow.remove_node",
            "strategy.workflow.update_node_metadata",
            "strategy.workflow.move_node",
            "strategy.workflow.set_node_param",
            "strategy.workflow.unset_node_param",
            "strategy.workflow.connect_nodes",
            "strategy.workflow.connect_input",
            "strategy.workflow.connect_output",
            "strategy.workflow.disconnect_link",
            "strategy.clear_strategy_workflow_draft",
            "backtest.run_backtest",
            "backtest.get_backtest_runs",
            "backtest.get_backtest_run_detail",
            "backtest.get_backtest_equity",
            "backtest.get_backtest_trades",
            "backtest.get_backtest_node_output",
        ),
    ),
    SubagentCatalogItem(
        id="data_resource_manager",
        title="Data Resource Manager",
        description="用于维护数据源与数据集资产。",
        default_tool_ids=(
            "datasource.create_datasource",
            "datasource.get_datasource_detail",
            "datasource.get_datasource_list",
            "datasource.update_datasource",
            "datasource.test_datasource_connection",
            "data_set.create_data_set",
            "data_set.get_data_set_detail",
            "data_set.get_data_set_list",
            "data_set.update_data_set",
            "data_set.get_data_set_panel_preview",
        ),
    ),
    SubagentCatalogItem(
        id="evaluation_profile_manager",
        title="Evaluation Profile Manager",
        description="用于维护因子评价方案，并发起与查询评价运行。",
        default_tool_ids=(
            "evaluation_profile.get_evaluation_profile_workflow_template",
            "evaluation_profile.get_workflow_node_types_source",
            "evaluation_profile.create_evaluation_profile",
            "evaluation_profile.get_evaluation_profile_detail",
            "evaluation_profile.get_evaluation_profile_list",
            "evaluation_profile.update_evaluation_profile",
            "evaluation_run.run_evaluation_run",
            "evaluation_run.list_evaluation_runs",
            "evaluation_run.get_evaluation_run_detail",
        ),
    ),
)


def get_subagent_catalog_item(subagent_id: str) -> SubagentCatalogItem | None:
    sid = (subagent_id or "").strip()
    for item in SUBAGENT_CATALOG:
        if item.id == sid:
            return item
    return None
