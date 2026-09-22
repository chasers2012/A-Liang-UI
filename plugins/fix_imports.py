"""
修复 plugins/ 目录下的导入路径
"""

import os
import re
from pathlib import Path

PACKAGES_MODULES = [
    "agents",
    "backtest",
    "chat",
    "config",
    "datasource",
    "data_set",
    "data_sync",
    "evaluation",
    "factors",
    "form",
    "knowledge",
    "market",
    "nodes",
    "plugin",
    "rerank",
    "strategy",
    "tool",
    "uploads",
    "visibility",
    "visualization",
]

INFRA_MODULES = [
    "common",
    "embedding",
    "events",
    "llm",
    "llm_tools",
    "persistence",
    "scheduler",
    "secret",
]

PLUGINS_DIR = Path("d:/workspace/quant-agent/plugins")


def fix_plugin_imports(filepath: Path) -> list:
    """修复插件文件中的导入"""
    changes = []

    with open(filepath, encoding="utf-8") as f:
        content = f.read()

    original_content = content

    # 修复 packages 模块的导入
    for module in PACKAGES_MODULES:
        pattern = rf"from app\.({module})\."
        replacement = r"from app.packages.\1."
        new_content = re.sub(pattern, replacement, content)
        if new_content != content:
            changes.append(f"  app.{module}.* -> app.packages.{module}.*")
            content = new_content

        pattern = rf"from app\.({module})\s"
        replacement = r"from app.packages.\1 "
        new_content = re.sub(pattern, replacement, content)
        if new_content != content:
            changes.append(f"  app.{module} -> app.packages.{module}")
            content = new_content

    # 修复 infra 模块的导入
    for module in INFRA_MODULES:
        pattern = rf"from app\.({module})\."
        replacement = r"from app.infra.\1."
        new_content = re.sub(pattern, replacement, content)
        if new_content != content:
            changes.append(f"  app.{module}.* -> app.infra.{module}.*")
            content = new_content

        pattern = rf"from app\.({module})\s"
        replacement = r"from app.infra.\1 "
        new_content = re.sub(pattern, replacement, content)
        if new_content != content:
            changes.append(f"  app.{module} -> app.infra.{module}")
            content = new_content

    if content != original_content:
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)

    return changes


def main():
    all_changes = []

    for root, _dirs, files in os.walk(PLUGINS_DIR):
        for file in files:
            if file.endswith(".py"):
                filepath = Path(root) / file
                changes = fix_plugin_imports(filepath)
                if changes:
                    rel = str(filepath.relative_to(PLUGINS_DIR.parent))
                    all_changes.append((rel, changes))

    print(f"Fixed {len(all_changes)} files:")
    for path, chgs in all_changes:
        print(f"  {path}")
        for c in chgs:
            print(f"    {c}")


if __name__ == "__main__":
    main()
