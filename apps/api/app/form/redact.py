from __future__ import annotations

from typing import Any

from app.form.schema import FormSchema


def redact_form(
    data: dict[str, Any],
    schema: FormSchema | None = None,
) -> dict[str, Any]:
    """
    Deep-copy ``data`` and replace top-level values for keys resolved as secret by
    ``schema`` (see :meth:`FormSchema.resolved_secret_keys`) with ``"***"``.

    If ``schema`` is None or resolves no secret keys, returns a deep copy unchanged.
    """

    secret_keys = frozenset(schema.resolved_secret_keys() if schema else [])

    def _walk(d: dict[str, Any], *, at_root: bool) -> dict[str, Any]:
        out: dict[str, Any] = {}
        for k, vv in d.items():
            sk = str(k)
            if at_root and sk in secret_keys:
                out[sk] = ""
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

    return _walk(dict(data), at_root=True)
