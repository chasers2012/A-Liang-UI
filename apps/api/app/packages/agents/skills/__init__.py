from __future__ import annotations

from pathlib import Path

from app.packages.agents.skill_store_sync import register_skill_source


def register_chat_agent_skills() -> None:
    """Register packaged chat-agent skills under /skills/common/<skill_name>/."""
    skills_dir = Path(__file__).resolve().parent / "common"
    for entry in sorted(skills_dir.iterdir()):
        if not entry.is_dir() or entry.name.startswith(".") or entry.name.startswith("__"):
            continue
        register_skill_source(module="common", skill_name=entry.name, skill_dir=entry)
