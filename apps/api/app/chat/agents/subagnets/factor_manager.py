from __future__ import annotations

from typing import Any

from factor import Factor

from .shared import (
    build_tools,
)

TOOL_IDS = {
    "factor.get_new_factor_template",
    "factor.create_factor",
    "factor.get_factor_detail",
    "factor.get_factor_list",
    "factor.update_factor",
}


def build_subagent() -> dict[str, Any] | None:

    factor_doc = str(getattr(Factor, "__doc__", ""))
    factor_doc_inline = " ".join(factor_doc.split()) if factor_doc else ""

    return {
        "name": "factor_manager",
        "description": (
            "用于创建、维护和查询量化因子资产。"
            + (
                f"（因子是 Factor 基类的派生类，以下为 Factor 基类 docstring 摘录：{factor_doc_inline}）这份说明对子代理是已知信息，不必在下达指令时对子代理复述。"
                if factor_doc_inline
                else ""
            )
            + "你向该子代理下达的指令必须符合 Factor 基类 docstring 中的原则和规范。"
        ),
        "system_prompt": (
            "你是 factor_manager 子代理，负责因子资产维护，完成需求中关于`因子`的部分，其他内容仅作为参考。"
            + (
                f"以下为 Factor 基类 docstring 摘录（作为实现与维护口径）：\n{factor_doc}\n"
                if factor_doc
                else ""
            )
            + "- 你应该拒绝执行任何你的工具功能所不能覆盖的任务。"
            + "- 如用用户指令与因子的规范、设计理念或用途存在冲突，你必须停止创建并上报问题，避免对因子的滥用。"
            + "- 除非被要求更多信息，否则返回尽可能简洁的结果，不要返回中间过程。返回的内容应该只包括客观事实，不要有任何评价。"
            + "- 在创建或编辑因子时，如果遇到任何逻辑困境或资源限制，你必须立即停止创建或编辑并上报问题，禁止使用任何形式的降级或兼容方案workaround。"
        ),
        "skills": ["/skills/"],
        **build_tools(TOOL_IDS),
    }
