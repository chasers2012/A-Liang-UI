from typing import Any

from .controller import get_module_config
from .registry import register_config_spec
from .schema import ConfigModuleSpec


class BaseConfig:
    category: str = ""
    category_label: str = ""
    description: str = ""

    @classmethod
    def register(cls):
        json_schema, ui_schema = cls.schema()
        defaults = cls.parse_schema_defaults(json_schema)

        spec = ConfigModuleSpec(
            key=cls.category,
            title=cls.category_label,
            description=cls.description,
            filename=f"{cls.category}.json",
            default_values=defaults,
            json_schema=json_schema,
            ui_schema=ui_schema,
        )
        register_config_spec(spec)

    @staticmethod
    def schema() -> tuple[dict[str, Any], dict[str, Any]]:
        return {}, {}

    @staticmethod
    def parse_schema_defaults(schema: dict[str, Any]) -> dict[str, Any]:
        defaults: dict[str, Any] = {}
        stack: list[Any] = [schema]
        branch_keys = ("dependencies", "allOf", "oneOf", "anyOf")

        while stack:
            node = stack.pop()
            if not isinstance(node, dict):
                continue

            properties = node.get("properties")
            if isinstance(properties, dict):
                for key, field_schema in properties.items():
                    if isinstance(field_schema, dict) and "default" in field_schema:
                        defaults[key] = field_schema["default"]
                    stack.append(field_schema)

            for branch_key in branch_keys:
                branch = node.get(branch_key)
                if isinstance(branch, dict):
                    stack.extend(branch.values())
                elif isinstance(branch, list):
                    stack.extend(branch)

        return defaults

    @classmethod
    def get_value(cls):
        return get_module_config(cls.category)
