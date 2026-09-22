import importlib
import os

from custom_code import Inheritance


def find_subclass_files(package_name, base_cls):
    spec = importlib.util.find_spec(package_name)
    if spec is None:
        raise ModuleNotFoundError(package_name)

    if not spec.submodule_search_locations:
        return []

    package_path = next(iter(spec.submodule_search_locations))

    results = []
    _inheritance = Inheritance(base_cls)

    for root, dirs, files in os.walk(package_path):
        # ✅ 排除 __pycache__
        dirs[:] = [d for d in dirs if d != "__pycache__"]

        for file in files:
            if not file.endswith(".py"):
                continue

            file_path = os.path.join(root, file)

            try:
                with open(file_path, encoding="utf-8") as f:
                    source = f.read()
                    if _inheritance.is_valid_subclass(source):
                        results.append(file_path)

            except Exception:
                # 忽略解析错误文件
                pass

    return list(set(results))
