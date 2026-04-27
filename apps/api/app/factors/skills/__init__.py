from pathlib import Path

from app.chat.agents.skill_store_sync import register_skill_source


def register_factor_skills() -> None:
    skills_dir = Path(__file__).resolve().parent
    for entry in sorted(skills_dir.iterdir()):
        if not entry.is_dir():
            continue
        if entry.name.startswith(".") or entry.name.startswith("__"):
            continue
        register_skill_source(
            module="factors",
            skill_name=entry.name,
            skill_dir=entry,
        )


register_factor_skills()
