#!/usr/bin/env python3
"""
Vision MCP Bridge — 通用图片分析 MCP Server.

将主模型（无 vision 能力）的图片分析请求代理到支持 vision 的外部 API。
通过环境变量驱动，不绑定任何特定 provider / model / API 格式。

环境变量（优先级：shell > .env > .claude/settings.json env）:

方式一：项目根目录 .env 文件（推荐，不提交 git）
  VISION_API_KEY=sk-xxx
  VISION_API_BASE_URL=https://api.minimaxi.com/anthropic
  VISION_MODEL=MiniMax-M3
  VISION_API_FORMAT=anthropic

方式二：~/.claude/settings.json 的 env 块（Claude Code 自动注入）
方式三：shell export（临时测试用）

Anthropic 格式示例:
  VISION_API_FORMAT=anthropic
  VISION_API_BASE_URL=https://api.minimaxi.com/anthropic
  VISION_MODEL=MiniMax-M3

OpenAI 格式示例:
  VISION_API_FORMAT=openai
  VISION_API_BASE_URL=https://api.openai.com/v1
  VISION_MODEL=gpt-4o

Usage:
  python3 scripts/vision-mcp-server.py
"""

import base64
import mimetypes
import os
import sys
from pathlib import Path

import httpx
from mcp.server.fastmcp import FastMCP

# ── 自动加载 .env（优先级最低，shell/env 覆盖）─────────────────────────

def _load_dotenv():
    """从项目根目录加载 .env，不覆盖已有的环境变量."""
    try:
        from dotenv import load_dotenv as _load
    except ImportError:
        return  # python-dotenv 未安装，跳过

    script_dir = Path(__file__).resolve().parent
    project_root = script_dir.parent  # scripts/ → project root
    env_file = project_root / ".env"
    if env_file.is_file():
        _load(env_file, override=False)

_load_dotenv()

# ── 配置（全部来自环境变量）──────────────────────────────────────────────

API_KEY = os.environ["VISION_API_KEY"]
BASE_URL = os.environ["VISION_API_BASE_URL"].rstrip("/")
MODEL = os.environ["VISION_MODEL"]
API_FORMAT = os.environ.get("VISION_API_FORMAT", "anthropic")

if API_FORMAT not in ("anthropic", "openai"):
    print(f"VISION_API_FORMAT must be 'anthropic' or 'openai', got: {API_FORMAT}", file=sys.stderr)
    sys.exit(1)

# ── MCP Server ───────────────────────────────────────────────────────────

mcp = FastMCP("vision-bridge")

SUPPORTED_EXTENSIONS = {".png", ".jpg", ".jpeg", ".gif", ".webp"}


def _guess_media_type(path: str) -> str:
    """从文件扩展名推断 MIME type，回退到 image/png."""
    ext = os.path.splitext(path)[1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise ValueError(
            f"Unsupported image format: {ext}. Supported: {', '.join(sorted(SUPPORTED_EXTENSIONS))}"
        )
    mt = mimetypes.types_map.get(ext)
    return mt if mt else "image/png"


def _build_anthropic_request(image_path: str, media_type: str, prompt: str) -> dict:
    """构建 Anthropic Messages API 请求体."""
    with open(image_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()

    return {
        "model": MODEL,
        "max_tokens": 4096,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": img_b64,
                        },
                    },
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    }


def _build_openai_request(image_path: str, media_type: str, prompt: str) -> dict:
    """构建 OpenAI Chat Completions API 请求体."""
    with open(image_path, "rb") as f:
        img_b64 = base64.b64encode(f.read()).decode()

    data_url = f"data:{media_type};base64,{img_b64}"

    return {
        "model": MODEL,
        "max_tokens": 4096,
        "messages": [
            {
                "role": "user",
                "content": [
                    {"type": "image_url", "image_url": {"url": data_url}},
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    }


def _extract_anthropic_text(data: dict) -> str:
    """从 Anthropic Messages API 响应中提取文本."""
    return data["content"][0]["text"]


def _extract_openai_text(data: dict) -> str:
    """从 OpenAI Chat Completions API 响应中提取文本."""
    return data["choices"][0]["message"]["content"]


# ── 按格式选择构建/提取函数 ─────────────────────────────────────────────

if API_FORMAT == "anthropic":
    _build_request = _build_anthropic_request
    _extract_text = _extract_anthropic_text
else:
    _build_request = _build_openai_request
    _extract_text = _extract_openai_text


# ── Tool ─────────────────────────────────────────────────────────────────


@mcp.tool()
async def analyze_image(
    image_path: str,
    prompt: str = "Describe this image in detail. Be specific about what you see.",
) -> str:
    """Analyze an image file using a vision-capable model.

    Use this tool when you need to understand the content of an image -
    screenshots, diagrams, photos, charts, UI mockups, etc.

    Args:
        image_path: Absolute path to the image file (.png, .jpg, .jpeg, .gif, .webp)
        prompt: What to look for or ask about the image.
                Default is a general description.
    """
    if not os.path.isfile(image_path):
        return f"Error: file not found: {image_path}"

    try:
        media_type = _guess_media_type(image_path)
    except ValueError as e:
        return str(e)

    body = _build_request(image_path, media_type, prompt)

    headers = {"content-type": "application/json"}
    if API_FORMAT == "anthropic":
        headers["x-api-key"] = API_KEY
        headers["anthropic-version"] = "2023-06-01"
    else:
        headers["Authorization"] = f"Bearer {API_KEY}"

    async with httpx.AsyncClient(timeout=120) as client:
        try:
            path = "/v1/messages" if API_FORMAT == "anthropic" else "/v1/chat/completions"
            resp = await client.post(f"{BASE_URL}{path}", headers=headers, json=body)
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            return f"API error ({e.response.status_code}): {e.response.text[:500]}"
        except httpx.RequestError as e:
            return f"Request failed: {e}"

    data = resp.json()
    return _extract_text(data)


# ── Entrypoint ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    # 启动前验证所有必需变量都存在
    missing = []
    for var in ("VISION_API_KEY", "VISION_API_BASE_URL", "VISION_MODEL"):
        if var not in os.environ:
            missing.append(var)
    if missing:
        print(f"Missing required env vars: {', '.join(missing)}", file=sys.stderr)
        print("Set them before running this server.", file=sys.stderr)
        sys.exit(1)

    mcp.run()
