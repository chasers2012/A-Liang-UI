from __future__ import annotations

from langgraph.checkpoint.memory import MemorySaver

_CHECKPOINTER: MemorySaver | None = None


def get_hitl_checkpointer() -> MemorySaver:
    """Process-wide checkpointer for HITL + resume.

    MemorySaver stores checkpoints in-process; thread isolation is done via `thread_id`.
    """

    global _CHECKPOINTER
    if _CHECKPOINTER is None:
        _CHECKPOINTER = MemorySaver()
    return _CHECKPOINTER
