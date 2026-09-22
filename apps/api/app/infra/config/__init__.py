from app.infra.config.base import BaseConfig
from app.infra.config.registry import get_config_spec, list_config_specs, register_config_spec

__all__ = ["BaseConfig", "get_config_spec", "list_config_specs", "register_config_spec"]
