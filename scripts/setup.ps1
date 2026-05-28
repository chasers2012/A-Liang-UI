# 初始化 monorepo 本地环境：pnpm（apps/web）+ uv（Python workspace）。在 Windows 上使用 PowerShell 运行。
# 用法：powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup.ps1
# 或：pnpm run setup:win

$ErrorActionPreference = "Stop"

function Die {
    param([string]$Message)
    Write-Host "error: $Message" -ForegroundColor Red
    exit 1
}

function Need-Command {
    param([string]$Name)
    if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
        Die "missing '$Name'. Install it and re-run this script."
    }
}

function Ensure-Uv {
    if (Get-Command uv -ErrorAction SilentlyContinue) {
        return
    }
    Write-Host "==> uv not found, installing via https://astral.sh/uv/install.ps1"
    try {
        Invoke-Expression (Invoke-RestMethod -Uri "https://astral.sh/uv/install.ps1")
    }
    catch {
        Die "uv install failed: $_"
    }
    $uvBin = Join-Path $HOME ".local\bin"
    $env:PATH = "$uvBin;$env:PATH"
    if (-not (Get-Command uv -ErrorAction SilentlyContinue)) {
        Die "uv was installed but is not on PATH; open a new shell or add $uvBin to PATH"
    }
}

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
Set-Location $repoRoot

Write-Host "==> A-Liang-UI setup (repo: $repoRoot)"

Need-Command pnpm
Ensure-Uv

if (Get-Command node -ErrorAction SilentlyContinue) {
    $nodeMajor = [int](node -p "process.versions.node.split('.')[0]")
    if ($nodeMajor -lt 20) {
        Die "Node.js 20+ required (found major version $nodeMajor)"
    }
}

Write-Host "==> pnpm install"
pnpm install

$venvPath = Join-Path $repoRoot ".venv"
if (-not (Test-Path -Path $venvPath -PathType Container)) {
    Write-Host "==> uv venv (create .venv)"
    uv venv
}
else {
    Write-Host "==> .venv already present, skip uv venv"
}

Write-Host "==> uv sync (Python workspace + lockfile)"
uv sync

Write-Host ""
Write-Host "Done. Next:"
Write-Host "  - Python: use 'uv run …' or: .\.venv\Scripts\Activate.ps1"
Write-Host "  - Copy env: see .env.example (web: apps/web/.env.local; API: apps/api/.env or system env)"
Write-Host "  - Dev: pnpm run dev (or pnpm run dev:web / pnpm run dev:api)"
