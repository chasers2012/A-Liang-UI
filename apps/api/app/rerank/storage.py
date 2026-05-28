from __future__ import annotations

from typing import Any

from app.rerank.plugins import get_rerank_plugin, list_rerank_plugins

ROOT_KEYS: tuple[str, ...] = ("rerank_provider",)
_RESERVED_KEYS = frozenset((*ROOT_KEYS, "rerank_providers"))


def inflate_rerank_config_for_ui(stored: dict[str, Any]) -> dict[str, Any]:
    """
    Flatten selected provider settings onto the root for RJSF editing.

    Persisted shape:
    - ``rerank_provider`` at root
    - provider fields under ``rerank_providers.<provider>``
    """
    data = dict(stored or {})
    provider = str(data.get("rerank_provider") or "").strip()
    providers = data.get("rerank_providers")
    if not provider or not isinstance(providers, dict):
        return data
    fragment = providers.get(provider)
    if not isinstance(fragment, dict):
        return data
    out = dict(data)
    out.update(dict(fragment))
    return out


def _get_provider(stored: dict[str, Any]) -> str:
    provider_value = stored.get("rerank_provider")
    return str(provider_value).strip() if provider_value else ""


def _load_existing_providers(existing: dict[str, Any] | None) -> dict[str, Any]:
    if isinstance(existing, dict) and isinstance(existing.get("rerank_providers"), dict):
        return dict(existing["rerank_providers"])
    return {}


def _merge_incoming_providers_map(providers: dict[str, Any], incoming: dict[str, Any]) -> None:
    incoming_providers = incoming.get("rerank_providers")
    if isinstance(incoming_providers, dict):
        providers.update(dict(incoming_providers))


def _copy_root_keys(out: dict[str, Any], incoming: dict[str, Any]) -> None:
    for key in ROOT_KEYS:
        if key in incoming:
            out[key] = incoming[key]


def _list_all_provider_field_keys() -> set[str]:
    keys: set[str] = set()
    for plugin in list_rerank_plugins():
        cfg = plugin.get_config_schema()
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
    plugin = get_rerank_plugin(provider)
    cfg_schema = plugin.get_config_schema()
    props = (cfg_schema.json_schema or {}).get("properties") if cfg_schema else None
    allowed_keys: set[str] | None = None
    if isinstance(props, dict):
        allowed_keys = {str(k) for k in props}

    existing_bucket = dict(providers.get(provider) or {})
    merged_bucket = dict(existing_bucket)

    incoming_providers = incoming.get("rerank_providers")
    if isinstance(incoming_providers, dict):
        nested_bucket = incoming_providers.get(provider)
        incoming_bucket_raw = dict(nested_bucket) if isinstance(nested_bucket, dict) else {}
    else:
        incoming_bucket_raw = {}
    incoming_bucket_raw.update({k: v for k, v in incoming.items() if k not in _RESERVED_KEYS})
    provider_specific = (
        {k: v for k, v in incoming_bucket_raw.items() if k in allowed_keys}
        if allowed_keys is not None
        else incoming_bucket_raw
    )
    normalized_specific = plugin.validate_config(provider_specific)
    merged_bucket.update(dict(normalized_specific))
    providers[provider] = merged_bucket


def _copy_root_extras_without_provider_fields(
    *,
    out: dict[str, Any],
    incoming: dict[str, Any],
    all_provider_keys: set[str],
) -> None:
    for key, value in incoming.items():
        if key in _RESERVED_KEYS:
            continue
        if key in all_provider_keys:
            continue
        out[key] = value


def split_rerank_config_for_storage(
    incoming: dict[str, Any],
    *,
    existing: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Split incoming rerank config into per-provider buckets for persistence.

    - Keeps only ``rerank_provider`` at root.
    - Stores provider fields under ``rerank_providers.<provider>``.
    - Preserves other providers' stored config.
    """
    data = dict(incoming or {})
    provider = _get_provider(data)

    out: dict[str, Any] = {}
    providers = _load_existing_providers(existing)
    _merge_incoming_providers_map(providers, data)

    _copy_root_keys(out, data)
    if provider:
        _write_provider_bucket(provider=provider, incoming=data, providers=providers)
    else:
        _copy_root_extras_without_provider_fields(
            out=out,
            incoming=data,
            all_provider_keys=_list_all_provider_field_keys(),
        )

    if providers:
        out["rerank_providers"] = providers
    return out
