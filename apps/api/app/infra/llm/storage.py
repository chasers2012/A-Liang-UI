from __future__ import annotations

from typing import Any

from .plugins import get_llm_plugin, list_llm_plugins

# Root only stores `provider`; everything else is stored under `providers.<provider>`.
ROOT_KEYS: tuple[str, ...] = ("provider",)
COMMON_PROVIDER_KEYS: tuple[str, ...] = ("model", "temperature", "max_tool_rounds")

_RESERVED_KEYS = frozenset((*ROOT_KEYS, "providers"))


def inflate_llm_config_for_ui(stored: dict[str, Any]) -> dict[str, Any]:
    """
    Convert persisted LLM config into a flat dict for UI forms.

    Stored shape:
    - `provider` at root
    - all other config under `providers.<provider>` (including model/temperature/max_tool_rounds)
    """
    data = dict(stored or {})
    provider = str(data.get("provider") or "").strip()
    providers = data.get("providers")
    if not provider or not isinstance(providers, dict):
        return data
    fragment = providers.get(provider)
    if not isinstance(fragment, dict):
        return data
    # Selected provider config overlays root for editing.
    out = dict(data)
    out.update(dict(fragment))
    return out


def _get_provider(stored: dict[str, Any]) -> str:
    provider_value = stored.get("provider")
    return str(provider_value).strip() if provider_value else ""


def _load_existing_providers(existing: dict[str, Any] | None) -> dict[str, Any]:
    if isinstance(existing, dict) and isinstance(existing.get("providers"), dict):
        return dict(existing["providers"])
    return {}


def _merge_incoming_providers_map(providers: dict[str, Any], incoming: dict[str, Any]) -> None:
    incoming_providers = incoming.get("providers")
    if isinstance(incoming_providers, dict):
        providers.update(dict(incoming_providers))


def _copy_common_keys(out: dict[str, Any], incoming: dict[str, Any]) -> None:
    for k in ROOT_KEYS:
        if k in incoming:
            out[k] = incoming[k]


def _list_all_provider_keys() -> set[str]:
    keys: set[str] = set()
    for p in list_llm_plugins():
        cfg = p.get_config_schema()
        props = (cfg.json_schema or {}).get("properties") if cfg else None
        if isinstance(props, dict):
            keys.update(str(k) for k in props)
    return keys


def _write_provider_bucket(
    *,
    provider: str,
    incoming: dict[str, Any],
    providers: dict[str, Any],
) -> None:
    plugin = get_llm_plugin(provider)
    cfg_schema = plugin.get_config_schema()
    props = (cfg_schema.json_schema or {}).get("properties") if cfg_schema else None
    allowed_keys: set[str] | None = None
    if isinstance(props, dict):
        allowed_keys = {str(k) for k in props}

    existing_bucket = dict(providers.get(provider) or {})
    merged_bucket = dict(existing_bucket)

    # Merge common provider keys (not validated by provider plugin).
    for k in COMMON_PROVIDER_KEYS:
        if k in incoming:
            merged_bucket[k] = incoming[k]

    # Merge provider-specific keys validated/normalized by plugin.
    incoming_bucket_raw = {k: v for k, v in incoming.items() if k not in _RESERVED_KEYS}
    provider_specific = (
        {k: v for k, v in incoming_bucket_raw.items() if k in allowed_keys}
        if allowed_keys is not None
        else incoming_bucket_raw
    )
    normalized_specific = plugin.validate_config(provider_specific)
    merged_bucket.update(dict(normalized_specific))

    providers[provider] = merged_bucket


def _copy_root_extras_without_provider(
    *,
    out: dict[str, Any],
    incoming: dict[str, Any],
    all_provider_keys: set[str],
) -> None:
    for k, v in incoming.items():
        if k in _RESERVED_KEYS:
            continue
        if k in all_provider_keys:
            continue
        out[k] = v


def split_llm_config_for_storage(
    incoming: dict[str, Any],
    *,
    existing: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Split incoming flat LLM config into per-provider buckets.

    - Keeps only `provider` at root.
    - Stores all other config under `providers.<provider>`.
    - Preserves other providers' stored config.
    """
    data = dict(incoming or {})
    provider = _get_provider(data)

    out: dict[str, Any] = {}
    providers = _load_existing_providers(existing)
    _merge_incoming_providers_map(providers, data)

    _copy_common_keys(out, data)
    if provider:
        _write_provider_bucket(provider=provider, incoming=data, providers=providers)
    else:
        _copy_root_extras_without_provider(
            out=out,
            incoming=data,
            all_provider_keys=_list_all_provider_keys(),
        )

    if providers:
        out["providers"] = providers
    return out
