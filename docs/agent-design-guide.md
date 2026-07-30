# PeekView Agent Design Guide

Prompts for AI agents building PeekView UI components. These reference DESIGN.md for decisions and `variables.css` for token values.

## General Prompt

> Build a [component/page] for PeekView using DESIGN.md. Use Vue 3 scoped CSS, semantic tokens (`--bg-*`, `--text-*`, `--border-*`, `--accent-*`), Inter + JetBrains Mono fonts, and Lucide icons. Support dark and light themes. Keep spacing on the 4px grid, body text 14px, border-radius 6-14px. Primary accent `#4d8dff` dark / `#0969da` light.

## Functional View Prompt

> Make it compact and scannable. Use `--bg-secondary` cards with `--border-color` borders, 16-24px padding, and hover lift. No hero gradients or background glow.

## Landing/Marketing Prompt

> Use the hero gradient text, centered layout, subtle radial glow, monospace eyebrow, and generous whitespace. One primary CTA with glow shadow.

## Component Request Prompt

> Build a [Button/Card/Modal/Toast/etc.] component matching DESIGN.md section 6. Include default, hover, focus, active, and disabled states. Use semantic tokens only — primitive `--c-*` tokens are reserved for `variables.css`.
