"""Human-message templates composed with runtime fields (non-system prompts)."""


def ideate_human_message(fields_txt: str, user_topic: str) -> str:
    return f"可用数据字段（节选）: {fields_txt}\n\n用户主题:\n{user_topic}"


def pseudocode_human_message(fields_txt: str, research_idea: str) -> str:
    return f"""可用数据字段（节选，dependencies 只能从中选择）: {fields_txt}

研究想法:
{research_idea}

请根据上述想法输出实现伪代码。"""


def codegen_human_message(
    fields_txt: str,
    research_idea: str,
    pseudocode: str,
    prev_err: str | None,
    repair: int,
) -> str:
    human = f"""可用字段（dependencies 只能从中多选）: {fields_txt}

研究想法:
{research_idea}

实施伪代码（请严格按此实现）:
{pseudocode}
"""
    if prev_err:
        human += f"""

上一次运行或校验失败，请修正代码（第 {repair} 次修复）:
{prev_err}
"""
    return human
