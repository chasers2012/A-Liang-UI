from __future__ import annotations

from pathlib import Path

from app.packages.agents.skill_store_sync import register_skill_source


def register_strategy_skills() -> None:
    """Register packaged strategy skills under /skills/strategy/<skill_name>/."""
    skills_dir = Path(__file__).resolve().parent
    for entry in sorted(skills_dir.iterdir()):
        if not entry.is_dir() or entry.name.startswith(".") or entry.name.startswith("__"):
            continue
        register_skill_source(module="strategy", skill_name=entry.name, skill_dir=entry)
