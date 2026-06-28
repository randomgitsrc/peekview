---
name: vision-analyzer
description: "Use when needing to analyze screenshots, verify UI rendering, inspect page elements, or get visual descriptions. All config via .env — not bound to any specific vision API provider."
---

# Vision Analyzer

## Usage

```bash
scripts/vision-analyze -i /tmp/screenshot.png -p "描述这张截图"
```

## Config

`.env`:

```bash
VISION_API_KEY=sk-xxx
VISION_API_BASE_URL=https://api.minimaxi.com/anthropic
VISION_MODEL=MiniMax-M3
VISION_API_FORMAT=anthropic
```

Change provider = change `.env`.

## Flow

1. playwright-vision skill → screenshot
2. `scripts/vision-analyze -i <screenshot> -p "describe"`
