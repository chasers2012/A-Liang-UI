from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from app.common.env import is_truthy
from app.startup_jobs import register_startup_job

from .store import get_agent_store

logger = logging.getLogger(__name__)

_SKILL_NAMESPACE = ("filesystem",)
_SKILL_ROOT = "/skills"


@dataclass(frozen=True)
class SkillSource:
    module: str
    skill_name: str
    skill_dir: Path

    @property
    def store_path(self) -> str:
        """Virtual store prefix: /skills/<module>/<skill_name> (module from register_skill_source)."""
        return _posix_join(_SKILL_ROOT, self.module, self.skill_name)


_SKILL_SOURCES: dict[tuple[str, str], SkillSource] = {}


def _normalize_name(value: str, *, field: str) -> str:
    normalized = value.strip().replace("\\", "/").strip("/")
    if not normalized:
        raise ValueError(f"{field} cannot be empty")
    if ".." in normalized.split("/"):
        raise ValueError(f"{field} cannot contain '..' path segments")
    return normalized


def _posix_join(*segments: str) -> str:
    parts: list[str] = []
    for segment in segments:
        segment = segment.strip().replace("\\", "/").strip("/")
        if segment:
            parts.append(segment)
    return "/" + "/".join(parts)


def register_skill_source(module: str, skill_name: str, skill_dir: Path) -> None:
    normalized_module = _normalize_name(module, field="module")
    normalized_skill_name = _normalize_name(skill_name, field="skill_name")
    resolved_path = Path(skill_dir).resolve()
    key = (normalized_module, normalized_skill_name)
    _SKILL_SOURCES[key] = SkillSource(
        module=normalized_module,
        skill_name=normalized_skill_name,
        skill_dir=resolved_path,
    )


def _to_store_value(content: str) -> dict[str, object]:
    now = datetime.now(UTC).isoformat()
    return {
        "content": content.split("\n"),
        "created_at": now,
        "modified_at": now,
    }


def _iter_skill_files(skill_dir: Path) -> list[tuple[Path, str]]:
    if not skill_dir.is_dir():
        raise NotADirectoryError(f"skill directory not found: {skill_dir}")

    files: list[tuple[Path, str]] = []
    for file_path in sorted(skill_dir.rglob("*")):
        if not file_path.is_file():
            continue
        relative_path = file_path.relative_to(skill_dir).as_posix()
        if any(part.startswith(".") or part.startswith("__") for part in relative_path.split("/")):
            continue
        files.append((file_path, relative_path))
    return files


@register_startup_job
async def sync_registered_skills_to_store() -> None:
    store = await get_agent_store()
    overwrite = is_truthy(os.getenv("OVERWRITE_SKILLS", "false"))
    total = len(_SKILL_SOURCES)
    created = 0
    overwritten = 0
    skipped = 0
    failed = 0

    for source in sorted(_SKILL_SOURCES.values(), key=lambda item: item.store_path):
        try:
            skill_files = _iter_skill_files(source.skill_dir)
            if not skill_files:
                raise FileNotFoundError(f"skill directory has no files: {source.skill_dir}")

            changed_in_source = False
            for file_path, relative_path in skill_files:
                key = f"{source.store_path}/{relative_path}"
                existing = await store.aget(_SKILL_NAMESPACE, key)
                if existing is not None and not overwrite:
                    skipped += 1
                    continue

                try:
                    content = file_path.read_text(encoding="utf-8")
                except UnicodeDecodeError:
                    skipped += 1
                    logger.warning(
                        "Skip non-utf8 skill file: module=%s skill=%s file=%s",
                        source.module,
                        source.skill_name,
                        file_path,
                    )
                    continue
                await store.aput(_SKILL_NAMESPACE, key, _to_store_value(content))
                changed_in_source = True
                if existing is None:
                    created += 1
                else:
                    overwritten += 1

            if not changed_in_source and not overwrite:
                logger.debug(
                    "Skill source skipped because all files already exist: module=%s skill=%s dir=%s",
                    source.module,
                    source.skill_name,
                    source.skill_dir,
                )
        except Exception:
            failed += 1
            logger.exception(
                "Failed to sync skill to store: module=%s skill=%s dir=%s",
                source.module,
                source.skill_name,
                source.skill_dir,
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
