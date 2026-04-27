from . import (
    data_resource_manager,
    evaluation_profile_manager,
    factor_manager,
    node_manager,
    research,
    strategy_builder,
)

SUBAGENT_BUILDERS = [
    # advisor.build_subagent,
    research.build_subagent,
    factor_manager.build_subagent,
    node_manager.build_subagent,
    strategy_builder.build_subagent,
    data_resource_manager.build_subagent,
    evaluation_profile_manager.build_subagent,
]
