from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from app.chat.agents.store import get_agent_store
from app.startup_jobs import register_startup_job

logger = logging.getLogger(__name__)

_SKILL_NAMESPACE = ("filesystem",)
_SKILL_ROOT = "/skills"


@dataclass(frozen=True)
class SkillSource:
    module: str
    skill_name: str
    file_path: Path

    @property
    def store_path(self) -> str:
        return f"/{self.skill_name}/SKILL.md"


_SKILL_SOURCES: dict[tuple[str, str], SkillSource] = {}


def _is_truthy(value: str | None) -> bool:
    if value is None:
        return False
    return value.strip().lower() in {"1", "true", "yes", "y", "on"}


def _normalize_name(value: str, *, field: str) -> str:
    normalized = value.strip().replace("\\", "/").strip("/")
    if not normalized:
        raise ValueError(f"{field} cannot be empty")
    return normalized


def register_skill_source(module: str, skill_name: str, file_path: Path) -> None:
    normalized_module = _normalize_name(module, field="module")
    normalized_skill_name = _normalize_name(skill_name, field="skill_name")
    resolved_path = Path(file_path).resolve()
    key = (normalized_module, normalized_skill_name)
    _SKILL_SOURCES[key] = SkillSource(
        module=normalized_module,
        skill_name=normalized_skill_name,
        file_path=resolved_path,
    )


def _to_store_value(content: str) -> dict[str, object]:
    now = datetime.now(UTC).isoformat()
    return {
        "content": content.split("\n"),
        "created_at": now,
        "modified_at": now,
    }


@register_startup_job
async def sync_registered_skills_to_store() -> None:
    store = await get_agent_store()
    overwrite = _is_truthy(os.getenv("OVERWRITE_SKILLS", "false"))
    total = len(_SKILL_SOURCES)
    created = 0
    overwritten = 0
    skipped = 0
    failed = 0

    for source in sorted(_SKILL_SOURCES.values(), key=lambda item: item.store_path):
        try:
            if not source.file_path.is_file():
                raise FileNotFoundError(f"skill file not found: {source.file_path}")

            key = source.store_path
            existing = await store.aget(_SKILL_NAMESPACE, key)
            if existing is not None and not overwrite:
                skipped += 1
                continue

            content = source.file_path.read_text(encoding="utf-8")
            await store.aput(_SKILL_NAMESPACE, key, _to_store_value(content))
            if existing is None:
                created += 1
            else:
                overwritten += 1
        except Exception:
            failed += 1
            logger.exception(
                "Failed to sync skill to store: module=%s skill=%s path=%s",
                source.module,
                source.skill_name,
                source.file_path,
            )

    logger.info(
        "Skill store sync finished: total=%s created=%s overwritten=%s skipped=%s failed=%s overwrite=%s",
        total,
        created,
        overwritten,
        skipped,
        failed,
        overwrite,
    )
