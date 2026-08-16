# dsh-manqu-pet Windows 委托验证入口:转发同一权威命令。
# 显式使用 Git for Windows 的 bash(PATH 中的 bash 可能是 WSL,会破坏
# Windows node_modules 的 esbuild 平台二进制)。纯 ASCII 输出,兼容 PS 5.1/7。
$ErrorActionPreference = "Stop"

$candidates = @(
    "$env:ProgramFiles\Git\bin\bash.exe",
    "$env:LOCALAPPDATA\Programs\Git\bin\bash.exe"
)
$bash = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $bash) {
    Write-Error "Git for Windows bash not found. Install Git for Windows and retry."
    exit 1
}

$root = Split-Path -Parent $PSScriptRoot
Push-Location $root
try {
    & $bash scripts/check.sh
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    Pop-Location
}
exit 0
