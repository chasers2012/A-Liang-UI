from collections.abc import Callable
from uuid import NAMESPACE_URL, uuid4, uuid5


def generate_id(namespace: str, name: str | None = None) -> str:
    name = str(uuid4()) if name is None else name
    return str(uuid5(uuid5(NAMESPACE_URL, namespace), name))


def create_id_generator(namespace: str) -> Callable[[str | None], str]:
    return lambda name: generate_id(namespace, name)
