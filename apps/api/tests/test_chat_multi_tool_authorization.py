from __future__ import annotations

import pytest
from app.chat.agent import _match_tool_call_ids_from_pending
from app.chat.controller import (
    _apply_authorization_decisions_to_blocks,
    _apply_stream_event_to_blocks,
)
from app.chat.events import ToolEvent, ToolPayload
from app.chat.schemas import AssistantBlockPublic, ChatAuthorizationRequest, ChatToolCallPublic


def test_chat_authorization_request_rejects_legacy_single_decision() -> None:
    with pytest.raises(ValueError, match="decisions"):
        ChatAuthorizationRequest.model_validate(
            {
                "session_id": "s1",
                "assistant_message_id": "a1",
                "decision": {"type": "approve"},
            }
        )


def test_chat_authorization_request_accepts_batch_decisions() -> None:
    req = ChatAuthorizationRequest.model_validate(
        {
            "session_id": "s1",
            "assistant_message_id": "a1",
            "decisions": [
                {"type": "approve", "tool_call_id": "call_1"},
                {"type": "reject", "tool_call_id": "call_2"},
            ],
        }
    )
    assert [d.type for d in req.decisions] == ["approve", "reject"]
    assert [d.tool_call_id for d in req.decisions] == ["call_1", "call_2"]


def test_chat_authorization_request_requires_decision_payload() -> None:
    with pytest.raises(ValueError, match="decisions"):
        ChatAuthorizationRequest.model_validate(
            {
                "session_id": "s1",
                "assistant_message_id": "a1",
            }
        )


def test_match_tool_call_ids_from_pending_supports_multiple_requests() -> None:
    pending = [
        ("call_1", "tool_alpha", '{"x": 1}'),
        ("call_2", "tool_beta", '{"k": "v"}'),
    ]
    interrupt_data = {
        "action_requests": [
            {"name": "tool_alpha", "args": {"x": 1}},
            {"name": "tool_beta", "args": {"k": "v"}},
        ]
    }
    assert _match_tool_call_ids_from_pending(pending, interrupt_data) == ["call_1", "call_2"]


def test_match_tool_call_ids_from_pending_handles_duplicate_requests() -> None:
    pending = [
        ("call_1", "tool_alpha", '{"x": 1}'),
        ("call_2", "tool_alpha", '{"x": 1}'),
    ]
    interrupt_data = {
        "action_requests": [
            {"name": "tool_alpha", "args": {"x": 1}},
            {"name": "tool_alpha", "args": {"x": 1}},
        ]
    }
    matched_ids = _match_tool_call_ids_from_pending(pending, interrupt_data)
    assert set(matched_ids) == {"call_1", "call_2"}
    assert len(matched_ids) == 2


def test_apply_stream_event_marks_tool_authorization_pending() -> None:
    blocks = [
        AssistantBlockPublic(
            kind="tool",
            call=ChatToolCallPublic(
                id="call_1",
                name="tool_alpha",
                args={"x": 1},
                status="running",
            ),
        )
    ]
    _apply_stream_event_to_blocks(
        blocks,
        ToolEvent(payload=ToolPayload(stage="authorize", id="call_1")),
    )
    assert blocks[0].call is not None
    assert blocks[0].call.authorization_status == "pending"


def test_apply_authorization_decisions_to_blocks_persists_decisions() -> None:
    blocks = [
        AssistantBlockPublic(
            kind="tool",
            call=ChatToolCallPublic(id="call_1", name="tool_alpha", status="running"),
        ),
        AssistantBlockPublic(
            kind="tool",
            call=ChatToolCallPublic(id="call_2", name="tool_beta", status="running"),
        ),
    ]
    _apply_authorization_decisions_to_blocks(
        blocks,
        [
            {"type": "approve", "tool_call_id": "call_1"},
            {"type": "reject", "tool_call_id": "call_2"},
        ],
    )
    assert blocks[0].call is not None
    assert blocks[1].call is not None
    assert blocks[0].call.authorization_status == "approved"
    assert blocks[1].call.authorization_status == "rejected"
