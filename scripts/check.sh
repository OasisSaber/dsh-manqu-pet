#!/usr/bin/env bash
# dsh-manqu-pet 权威验证入口(供 TheMasterplan 中央工作流调用)。
# 契约:非交互;失败时返回非零;不依赖本机绝对路径;不读取未声明 Secret;
# 不执行部署/发布/远端修改;能在全新 checkout 中运行;输出足以定位错误。
set -euo pipefail
cd "$(dirname "$0")/.."

# 依赖自举:全新 checkout 缺少 esbuild 时安装(仅 devDependency,单包)。
if [ ! -d node_modules/esbuild ]; then
  echo "[check] installing dev dependencies (npm ci)"
  npm ci --no-audit --no-fund
fi

echo "[check] unit tests (node --test)"
node --test tests/*.test.mjs

echo "[check] client bundle freshness (build --check)"
node scripts/build-client.mjs --check

echo "[check] workspace hygiene (git diff --check)"
git diff --check

echo "[check] OK"
