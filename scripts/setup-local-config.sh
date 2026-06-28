#!/bin/bash
# Setup local dev config after git clone
# Creates .claude/ and .opencode/ symlinks for agent definitions.
#
# Usage:
#   bash scripts/setup-local-config.sh

set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "=== PeekView 本地配置初始化 ==="
echo ""

# ── .opencode/agents ──
echo "→ .opencode/agents ..."
mkdir -p .opencode
if [ ! -e .opencode/agents ]; then
    ln -s ../docs/converse/agents .opencode/agents
    echo "  ✅ symlink created: .opencode/agents → docs/converse/agents"
else
    echo "  ✓ already exists"
fi

# ── .claude/agents ──
echo "→ .claude/agents ..."
mkdir -p .claude
if [ ! -e .claude/agents ]; then
    ln -s ../docs/converse/agents .claude/agents
    echo "  ✅ symlink created: .claude/agents → docs/converse/agents"
else
    echo "  ✓ already exists"
fi

# ── .claude/mcp.json ──
echo "→ .claude/mcp.json ..."
if [ ! -f .claude/mcp.json ]; then
    echo '{"mcpServers":{}}' > .claude/mcp.json
    echo "  ✅ created (empty)"
else
    echo "  ✓ already exists"
fi

# ── .claude/settings.local.json ──
echo "→ .claude/settings.local.json ..."
if [ ! -f .claude/settings.local.json ]; then
    cat > .claude/settings.local.json << 'JSONEOF'
{
  "enabledMcpjsonServers": []
}
JSONEOF
    echo "  ✅ created (minimal)"
else
    echo "  ✓ already exists"
fi

echo ""
echo "=== 手动步骤 ==="
echo ""
echo "1. Vision 能力（可选）：创建 ~/.env，内容："
echo ""
echo "   VISION_API_KEY=sk-xxx"
echo "   VISION_API_BASE_URL=https://api.minimaxi.com/anthropic"
echo "   VISION_MODEL=MiniMax-M3"
echo "   VISION_API_FORMAT=anthropic"
echo ""
echo "2. 后端开发环境：make dev"
echo "3. 前端依赖：cd frontend-v3 && npm install"
echo ""
echo "=== 初始化完成 ==="
