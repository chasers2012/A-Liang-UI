# Gitflow（本仓库约定）

长期分支：

| 分支 | 用途 |
|------|------|
| `master` | 生产/可发布历史（与远端保护分支配合使用） |
| `develop` | 日常集成分支，功能合并到这里 |

短期分支（从何处分出 → 合并回何处）：

| 类型 | 命名 | 从 | 合并到 |
|------|------|-----|--------|
| 功能 | `feature/<简述>` | `develop` | `develop` |
| 发布 | `release/<版本或日期>` | `develop` | `develop` 与 `master` |
| 热修 | `hotfix/<简述>` | `master` | `develop` 与 `master` |

## 常用 Git 命令（不依赖 git-flow 插件）

```bash
# 新功能
git checkout develop
git pull
git checkout -b feature/my-change

# 完成后（通过 PR 合并到 develop，或本地合并）
git checkout develop
git merge --no-ff feature/my-change
```

```bash
# 发布：冻结 develop，只修 bug / 版本号
git checkout develop
git pull
git checkout -b release/1.0.0
# … 修改版本号、修发布问题 …
# 合并到 master 并打 tag，再合并回 develop
```

```bash
# 线上热修
git checkout master
git pull
git checkout -b hotfix/critical-fix
# … 修复 …
# 合并到 master（打 tag）与 develop
```

## 可选：git-flow 命令行扩展

若已安装 [git-flow (AVH Edition)](https://github.com/petervanderdoes/gitflow-avh/wiki/Installation)：

```bash
git flow init -d
```

按提示将生产分支设为 `master`、开发分支设为 `develop` 即可与上表一致。

## 提交说明（Conventional Commits）

与 Gitflow 分支模型常见搭配：使用 [Conventional Commits](https://www.conventionalcommits.org/)，由根目录 Husky `commit-msg` 钩子经 commitlint 校验。

格式：

```text
<type>(<optional-scope>): <subject>

[optional body]

[optional footer(s)]
```

常用 `type`：`feat`、`fix`、`docs`、`style`、`refactor`、`perf`、`test`、`build`、`ci`、`chore`。

示例：

- `feat(web): add strategy list page`
- `fix(api): correct CORS for localhost`
- `chore: bump lockfile`

`git merge` / `git revert` 产生的说明会被钩子忽略，不做该格式校验。

## CI

推送到 `master` / `main` / `develop` 以及 `feature/*`、`release/*`、`hotfix/*` 会触发 `.github/workflows/ci.yml`。
