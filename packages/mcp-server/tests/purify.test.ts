import { describe, it, expect } from 'vitest';
import { purifyContent } from '../src/lib/purify.js';

// ── 净化共用样例（与 backend/tests/test_purify.py 逐字一致，DEBT0004 契约锚点）──
const MD_WITH_ALT = '![alt text](data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE=)';
const IMG_NO_ALT = '<img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE=">';
const IMG_WITH_ALT = '<img alt="icon" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAE=">';
const UPPERCASE = '![logo](Data:IMAGE/jpeg;base64,QUJDREVGRw==)';
const WS_VARIANT = 'data: image/png;base64,QUJDREVGRw==';
const PLAIN_TEXT = 'plain text with no data:image inside';

const PLACEHOLDER_RE = /\[image:\s*[^\]]*\(\d+(\.\d+)? KB, base64\)\]/;

describe('purifyContent', () => {
  it('BDD-12 markdown base64 替换为占位符并保留 alt', () => {
    const result = purifyContent(MD_WITH_ALT);
    expect(result).toMatch(/\[image:\s*alt text\s*\(\d+(\.\d+)? KB, base64\)\]/);
    expect(result).not.toContain('iVBORw0KGgoAAAANSUhEUgAAAAE=');
  });

  it('BDD-12 <img> 无 alt 替换', () => {
    const result = purifyContent(IMG_NO_ALT);
    expect(result).toMatch(PLACEHOLDER_RE);
    expect(result).not.toContain('iVBORw0KGgoAAAANSUhEUgAAAAE=');
  });

  it('BDD-12 <img alt> 保留 alt', () => {
    const result = purifyContent(IMG_WITH_ALT);
    expect(result).toMatch(/\[image:\s*icon\s*\(\d+(\.\d+)? KB, base64\)\]/);
    expect(result).not.toContain('iVBORw0KGgoAAAANSUhEUgAAAAE=');
  });

  it('BDD-12 大写 Data:IMAGE 替换', () => {
    const result = purifyContent(UPPERCASE);
    expect(result).toMatch(/\[image:\s*logo\s*\(\d+(\.\d+)? KB, base64\)\]/);
    expect(result).not.toContain('QUJDREVGRw==');
  });

  it('BDD-12 空白变体 data: image/ 替换', () => {
    const result = purifyContent(WS_VARIANT);
    expect(result).toMatch(PLACEHOLDER_RE);
    expect(result).not.toContain('QUJDREVGRw==');
  });

  it('BDD-14 无 base64 普通文本原样返回', () => {
    expect(purifyContent(PLAIN_TEXT)).toBe(PLAIN_TEXT);
  });
});
