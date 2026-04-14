from __future__ import annotations

from app.config.schema import ConfigModuleSpec

_REGISTRY: dict[str, ConfigModuleSpec] = {}


def register_config_spec(spec: ConfigModuleSpec) -> None:
    key = spec.key.strip()
    if key in _REGISTRY:
        raise ValueError(f"config module already registered: {key!r}")
    _REGISTRY[key] = spec


def get_config_spec(module_key: str) -> ConfigModuleSpec | None:
    return _REGISTRY.get(str(module_key or "").strip())


def list_config_specs() -> list[ConfigModuleSpec]:
    return sorted(
        _REGISTRY.values(),
        key=lambda item: (item.title.lower(), item.key.lower()),
    )
