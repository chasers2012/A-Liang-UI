from __future__ import annotations


class DataPreprocessorBase:
    """Base type for preprocessors."""

    def transform(self) -> None:
        raise NotImplementedError
