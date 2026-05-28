"""
Local workspace root for on-disk data.

Default directory is ``~/.a-liang-ui``. Override with the ``WORKSPACE_ROOT``
environment variable, or call ``set_workspace_root`` for an in-process override.
"""

from __future__ import annotations

import os
from pathlib import Path

PathPart = str | Path

_ENV_WORKSPACE = "WORKSPACE_ROOT"
_DEFAULT_DIRNAME = ".a-liang-ui"

_runtime_root: Path | None = None


def default_workspace_root() -> Path:
    """Logical root when no in-process override: env ``WORKSPACE_ROOT`` else ``~/.a-liang-ui``."""
    env = os.environ.get(_ENV_WORKSPACE)
    if env:
        return Path(env).expanduser().resolve()
    return (Path.home() / _DEFAULT_DIRNAME).resolve()


def get_workspace_root() -> Path:
    """Current workspace root (absolute)."""
    if _runtime_root is not None:
        return _runtime_root
    return default_workspace_root()


def set_workspace_root(path: PathPart | None) -> None:
    """Set in-process root; ``None`` clears override (back to env / default)."""
    global _runtime_root
    if path is None:
        _runtime_root = None
        return
    _runtime_root = Path(path).expanduser().resolve()


def workspace_path(*parts: PathPart) -> Path:
    """Join paths under the workspace root (directories need not exist)."""
    root = get_workspace_root()
    if not parts:
        return root
    return root.joinpath(*[Path(p) for p in parts])


def ensure_dir(*parts: PathPart) -> Path:
    """Ensure ``workspace_path(*parts)`` exists (mkdir -p) and return it."""
    p = workspace_path(*parts)
    p.mkdir(parents=True, exist_ok=True)
    return p


class Workspace:
    """Workspace bound to a root (defaults to module ``get_workspace_root()``)."""

    def __init__(self, root: PathPart | None = None):
        if root is None:
            self._root = get_workspace_root()
        else:
            self._root = Path(root).expanduser().resolve()

    @property
    def root(self) -> Path:
        return self._root

    def path(self, *parts: PathPart) -> Path:
        if not parts:
            return self._root
        return self._root.joinpath(*[Path(p) for p in parts])

    def ensure_dir(self, *parts: PathPart) -> Path:
        p = self.path(*parts)
        p.mkdir(parents=True, exist_ok=True)
        return p


__all__ = [
    "Workspace",
    "default_workspace_root",
    "ensure_dir",
    "get_workspace_root",
    "set_workspace_root",
    "workspace_path",
]
