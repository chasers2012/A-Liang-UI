from __future__ import annotations


class JobCancelledError(Exception):
    """Raised when a job is cancelled while running."""
