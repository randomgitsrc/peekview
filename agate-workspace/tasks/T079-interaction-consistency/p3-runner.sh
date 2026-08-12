#!/bin/bash
# P3 TDD runner for vitest — ignores -q flag appended by check-tdd-red.sh
cd /home/kity/oclab/peekview/frontend-v3
npx vitest run src/components/__tests__/AuthButton.spec.ts src/components/__tests__/UserMenu.spec.ts src/components/__tests__/EntryDetailTags.spec.ts
