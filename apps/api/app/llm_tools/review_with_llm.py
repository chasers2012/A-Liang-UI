from __future__ import annotations

import json
from typing import Any, Literal, TypeVar

from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel

TReviewModel = TypeVar("TReviewModel", bound=BaseModel)


def review_with_llm(
    *,
    system_prompt: str,
    review_prompt: str,
    review_input: Any,
    output_model: type[TReviewModel],
    input_format: Literal["json", "python", "text"] = "json",
    input_title: str = "审查对象如下：",
    reject_message_prefix: str = "审查未通过",
) -> dict[str, Any]:
    # Lazy import avoids introducing module import cycles.
    from app.chat.controller import build_chat_model

    llm = build_chat_model()

    if input_format == "json":
        rendered_input = json.dumps(review_input, ensure_ascii=False)
    else:
        rendered_input = str(review_input)

    human_content = f"{review_prompt}\n\n{input_title}\n```{input_format}\n{rendered_input}\n```"
    structured_llm = llm.with_structured_output(output_model)
    review = structured_llm.invoke(
        [
            SystemMessage(content=system_prompt),
            HumanMessage(content=human_content),
        ],
        config={"metadata": {"silent_stream": True}},
    )

    approved = bool(getattr(review, "approved", True))
    if not approved:
        issues_raw = getattr(review, "issues", [])
        issues = issues_raw if isinstance(issues_raw, list) else []
        issue_text = "；".join(str(x) for x in issues if str(x).strip()) or reject_message_prefix
        raise ValueError(f"{reject_message_prefix}：{issue_text}")

    return review.model_dump(mode="json")
