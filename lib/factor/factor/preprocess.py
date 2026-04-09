from __future__ import annotations


class DataPreprocessorBase:
    """Legacy compatibility base for user-defined preprocessors.

    New workflow-node based preprocessors do not have to inherit from this class
    as long as they provide a compatible ``transform()`` method.
    """

    def transform(self) -> None:
        raise NotImplementedError
