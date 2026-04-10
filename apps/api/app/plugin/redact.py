from __future__ import annotations

from typing import Any

from app.plugin.schema import PluginConfigSchema


def redact_config(
    config: dict[str, Any],
    schema: PluginConfigSchema | None = None,
) -> dict[str, Any]:
    """
    Deep-copy ``config`` and replace top-level values whose keys are marked
    ``secret`` on ``PluginConfigField`` in ``schema`` with ``"***"``.

    If ``schema`` is None or has no secret fields, returns a deep copy unchanged.
    """

    fields = (schema.fields or []) if schema else []
    secret_keys = frozenset(f.key for f in fields if f.secret)

    def _walk(d: dict[str, Any], *, at_root: bool) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for k, vv in d.items():
            sk = str(k)
            if at_root and sk in secret_keys:
                out[sk] = "***"
            elif isinstance(vv, dict):
                out[sk] = _walk(vv, at_root=False)
            elif isinstance(vv, list):
                out[sk] = [_item(x) for x in vv]
            else:
                out[sk] = vv
        return out

    def _item(x: Any) -> Any:
        if isinstance(x, dict):
            return _walk(x, at_root=False)
        if isinstance(x, list):
            return [_item(i) for i in x]
        return x

    return _walk(dict(config), at_root=True)
